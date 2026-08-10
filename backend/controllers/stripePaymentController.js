// controllers/stripePaymentController.js
import Stripe from 'stripe';
import dotenv from 'dotenv';
import Payment from '../models/Payment.js';
import Appointment from '../models/appointment.model.js';
import Booking from '../models/testBooking.models.js';
import MedicineOrder from '../models/MedicineOrder.js';
import Doctor from '../models/doctors.model.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ========================
// CREATE PAYMENT INTENT
// ========================
export const createPaymentIntent = async (req, res) => {
  try {
    const { 
      bookingType,       // 'appointment', 'lab_booking', 'medicine_order'
      bookingId,         // The MongoDB _id of the booking
      amount,            // Amount in rupees (e.g. 1000 for Rs. 1000)
      customerName,
      customerEmail,
      customerPhone
    } = req.body;

    // Validate
    if (!bookingType || !bookingId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'bookingType, bookingId, and amount are required' 
      });
    }

    const validTypes = ['appointment', 'lab_booking', 'medicine_order'];
    if (!validTypes.includes(bookingType)) {
      return res.status(400).json({ success: false, message: 'Invalid booking type' });
    }

    if (amount < 50) {
      return res.status(400).json({ success: false, message: 'Minimum amount is Rs. 50' });
    }

    // Get booking details to determine provider
    let providerType, providerId, providerName, bookingRecord;

    if (bookingType === 'appointment') {
      bookingRecord = await Appointment.findById(bookingId).populate('doctor', 'name');
      if (!bookingRecord) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }
      providerType = 'doctor';
      providerId = bookingRecord.doctor._id;
      providerName = bookingRecord.doctor.name;
    } 
    else if (bookingType === 'lab_booking') {
      bookingRecord = await Booking.findById(bookingId).populate('lab', 'name');
      if (!bookingRecord) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      providerType = 'lab';
      providerId = bookingRecord.lab._id;
      providerName = bookingRecord.lab.name;
    } 
    else if (bookingType === 'medicine_order') {
      bookingRecord = await MedicineOrder.findById(bookingId);
      if (!bookingRecord) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      providerType = 'pharmacy';
      providerId = bookingRecord.pharmacyId || 'unknown';
      providerName = 'Pharmacy';
    }

    // Calculate commission (10%)
    const amountInPaise = Math.round(amount * 100); // Convert to paise/cents
    const commissionPercent = 10;
    const commissionAmount = Math.round(amount * commissionPercent / 100);
    const providerAmount = amount - commissionAmount;

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: 'pkr',
      metadata: {
        bookingType,
        bookingId: String(bookingId),
        providerType,
        providerId: String(providerId),
        commissionPercent: String(commissionPercent),
        commissionAmount: String(commissionAmount),
        providerAmount: String(providerAmount)
      },
      description: `${bookingType} - ${customerName || 'Customer'}`
    });

    // Save payment record
    const payment = new Payment({
      bookingType,
      bookingId,
      customerName,
      customerEmail,
      customerPhone,
      totalAmount: amount,
      commissionPercent,
      commissionAmount,
      providerAmount,
      providerType,
      providerId,
      providerName,
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
      status: 'pending'
    });

    await payment.save();

    console.log(`✅ PaymentIntent created: ${paymentIntent.id} for Rs.${amount}`);

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        clientSecret: paymentIntent.client_secret,
        stripePaymentIntentId: paymentIntent.id,
        totalAmount: amount,
        commissionAmount,
        providerAmount,
        providerName
      }
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create payment intent' 
    });
  }
};

// ========================
// CONFIRM PAYMENT (webhook or manual)
// ========================
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: 'PaymentIntent ID is required' });
    }

    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Retrieve payment intent from Stripe to verify status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      payment.status = 'succeeded';
      payment.paidAt = new Date();
      await payment.save();

      // Update the original booking's payment status
      await updateBookingPaymentStatus(payment);

      console.log(`✅ Payment confirmed: ${paymentIntentId}`);

      return res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: {
          payment,
          bookingType: payment.bookingType,
          bookingId: payment.bookingId
        }
      });
    } else {
      return res.json({
        success: false,
        message: `Payment status is ${paymentIntent.status}. Not yet completed.`,
        stripeStatus: paymentIntent.status
      });
    }

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// STRIPE WEBHOOK
// ========================
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handleSuccessfulPayment(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handleFailedPayment(failedPayment);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
};

// ========================
// HELPER FUNCTIONS
// ========================

async function handleSuccessfulPayment(paymentIntent) {
  const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
  if (!payment) {
    console.error(`Payment record not found for PI: ${paymentIntent.id}`);
    return;
  }

  payment.status = 'succeeded';
  payment.paidAt = new Date();
  await payment.save();

  await updateBookingPaymentStatus(payment);
  console.log(`💰 Webhook: Payment succeeded for ${paymentIntent.id}`);
}

async function handleFailedPayment(paymentIntent) {
  const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
  if (!payment) return;

  payment.status = 'failed';
  await payment.save();
  console.log(`❌ Webhook: Payment failed for ${paymentIntent.id}`);
}

async function updateBookingPaymentStatus(payment) {
  try {
    if (payment.bookingType === 'appointment') {
      await Appointment.findByIdAndUpdate(payment.bookingId, {
        paymentStatus: 'paid',
        status: 'confirmed'
      });
    } 
    else if (payment.bookingType === 'lab_booking') {
      await Booking.findByIdAndUpdate(payment.bookingId, {
        paymentStatus: 'paid',
        bookingStatus: 'confirmed'
      });
    } 
    else if (payment.bookingType === 'medicine_order') {
      await MedicineOrder.findByIdAndUpdate(payment.bookingId, {
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
        status: 'confirmed'
      });
    }
  } catch (error) {
    console.error('Error updating booking payment status:', error);
  }
}

// ========================
// GET PAYMENT STATUS
// ========================
export const getPaymentStatus = async (req, res) => {
  try {
    const { bookingType, bookingId } = req.query;

    if (!bookingType || !bookingId) {
      return res.status(400).json({ success: false, message: 'bookingType and bookingId are required' });
    }

    const payment = await Payment.findOne({ bookingType, bookingId })
      .sort({ createdAt: -1 });

    if (!payment) {
      return res.json({ 
        success: true, 
        data: { status: 'no_payment', paid: false } 
      });
    }

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
        paid: payment.status === 'succeeded',
        totalAmount: payment.totalAmount,
        commissionAmount: payment.commissionAmount,
        providerAmount: payment.providerAmount,
        paidAt: payment.paidAt
      }
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// ADMIN: GET COMMISSION REPORT
// ========================
export const getCommissionReport = async (req, res) => {
  try {
    const { startDate, endDate, providerType } = req.query;

    let query = { status: 'succeeded' };
    
    if (startDate || endDate) {
      query.paidAt = {};
      if (startDate) query.paidAt.$gte = new Date(startDate);
      if (endDate) query.paidAt.$lte = new Date(endDate);
    }
    
    if (providerType) {
      query.providerType = providerType;
    }

    const payments = await Payment.find(query).sort({ paidAt: -1 });

    const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCommission = payments.reduce((sum, p) => sum + p.commissionAmount, 0);
    const totalPayout = payments.reduce((sum, p) => sum + p.providerAmount, 0);

    res.json({
      success: true,
      data: {
        stats: {
          totalTransactions: payments.length,
          totalRevenue,
          totalCommission,
          totalPayout,
          commissionRate: '10%'
        },
        payments
      }
    });

  } catch (error) {
    console.error('Error fetching commission report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};