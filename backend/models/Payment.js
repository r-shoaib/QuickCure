// models/Payment.js
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // Original booking reference
  bookingType: {
    type: String,
    enum: ['appointment', 'lab_booking', 'medicine_order'],
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Customer info
  customerName: { type: String },
  customerEmail: { type: String },
  customerPhone: { type: String },

  // Amounts
  totalAmount: { type: Number, required: true },  // What customer paid
  commissionPercent: { type: Number, default: 10 }, // 10%
  commissionAmount: { type: Number, default: 0 },   // 10% of total
  providerAmount: { type: Number, default: 0 },     // After deducting 10%
  
  // Provider info (doctor/lab/pharmacy)
  providerType: {
    type: String,
    enum: ['doctor', 'lab', 'pharmacy'],
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  providerName: { type: String },

  // Stripe details
  stripePaymentIntentId: { type: String },
  stripeClientSecret: { type: String },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
    default: 'pending'
  },

  // Commission payout status
  commissionPaid: {
    type: Boolean,
    default: false
  },
  commissionPaidAt: { type: Date },

  // Timeline
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date },
  refundedAt: { type: Date }
}, { timestamps: true });

// Indexes
paymentSchema.index({ bookingType: 1, bookingId: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ providerType: 1, providerId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;