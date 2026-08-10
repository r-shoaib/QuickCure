// controllers/revenueController.js
import Payment from '../models/Payment.js';
import Appointment from '../models/appointment.model.js';
import Booking from '../models/testBooking.models.js';
import MedicineOrder from '../models/MedicineOrder.js';

// ========================
// PROVIDER REVENUE (for lab/doctor/pharmacy dashboards)
// ========================
export const getProviderRevenue = async (req, res) => {
  try {
    const { providerType, providerId } = req.params;

    if (!providerType || !providerId) {
      return res.status(400).json({ success: false, message: 'providerType and providerId are required' });
    }

    const validTypes = ['doctor', 'lab', 'pharmacy'];
    if (!validTypes.includes(providerType)) {
      return res.status(400).json({ success: false, message: 'Invalid provider type' });
    }

    // Get all succeeded payments for this provider
    const payments = await Payment.find({
      providerType,
      providerId,
      status: 'succeeded'
    }).sort({ paidAt: -1 });

    // Calculate totals
    const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCommission = payments.reduce((sum, p) => sum + p.commissionAmount, 0);
    const totalPayout = payments.reduce((sum, p) => sum + p.providerAmount, 0);
    const totalTransactions = payments.length;

    // Monthly breakdown (last 12 months)
    const monthlyData = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthPayments = payments.filter(p => {
        const paidAt = new Date(p.paidAt);
        return paidAt >= month && paidAt < monthEnd;
      });

      monthlyData.push({
        month: month.toLocaleString('default', { month: 'short' }),
        year: month.getFullYear(),
        revenue: monthPayments.reduce((sum, p) => sum + p.totalAmount, 0),
        commission: monthPayments.reduce((sum, p) => sum + p.commissionAmount, 0),
        payout: monthPayments.reduce((sum, p) => sum + p.providerAmount, 0),
        transactions: monthPayments.length
      });
    }

    // Revenue by booking type
    const byBookingType = {};
    for (const type of ['appointment', 'lab_booking', 'medicine_order']) {
      const typePayments = payments.filter(p => p.bookingType === type);
      byBookingType[type] = {
        count: typePayments.length,
        revenue: typePayments.reduce((sum, p) => sum + p.totalAmount, 0),
        commission: typePayments.reduce((sum, p) => sum + p.commissionAmount, 0),
        payout: typePayments.reduce((sum, p) => sum + p.providerAmount, 0)
      };
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalCommission,
          totalPayout,
          totalTransactions,
          commissionRate: '10%'
        },
        monthlyData,
        byBookingType,
        recentTransactions: payments.slice(0, 20)
      }
    });

  } catch (error) {
    console.error('Error fetching provider revenue:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// ADMIN: REVENUE BREAKDOWN BY PROVIDER TYPE
// ========================
export const getAdminRevenueBreakdown = async (req, res) => {
  try {
    // Get all succeeded payments
    const payments = await Payment.find({ status: 'succeeded' });

    // Overall totals
    const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalCommission = payments.reduce((sum, p) => sum + p.commissionAmount, 0);
    const totalPayout = payments.reduce((sum, p) => sum + p.providerAmount, 0);

    // Revenue by provider type
    const byProviderType = {};
    for (const type of ['doctor', 'lab', 'pharmacy']) {
      const typePayments = payments.filter(p => p.providerType === type);
      byProviderType[type] = {
        count: typePayments.length,
        revenue: typePayments.reduce((sum, p) => sum + p.totalAmount, 0),
        commission: typePayments.reduce((sum, p) => sum + p.commissionAmount, 0),
        payout: typePayments.reduce((sum, p) => sum + p.providerAmount, 0)
      };
    }

    // Revenue by booking type
    const byBookingType = {};
    for (const type of ['appointment', 'lab_booking', 'medicine_order']) {
      const typePayments = payments.filter(p => p.bookingType === type);
      byBookingType[type] = {
        count: typePayments.length,
        revenue: typePayments.reduce((sum, p) => sum + p.totalAmount, 0),
        commission: typePayments.reduce((sum, p) => sum + p.commissionAmount, 0)
      };
    }

    // Monthly commission trend (last 12 months)
    const monthlyData = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthPayments = payments.filter(p => {
        const paidAt = new Date(p.paidAt);
        return paidAt >= month && paidAt < monthEnd;
      });

      monthlyData.push({
        month: month.toLocaleString('default', { month: 'short' }),
        year: month.getFullYear(),
        revenue: monthPayments.reduce((sum, p) => sum + p.totalAmount, 0),
        commission: monthPayments.reduce((sum, p) => sum + p.commissionAmount, 0),
        payouts: monthPayments.reduce((sum, p) => sum + p.providerAmount, 0),
        transactions: monthPayments.length
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalCommission,
          totalPayout,
          totalTransactions: payments.length,
          commissionRate: '10%'
        },
        byProviderType,
        byBookingType,
        monthlyData,
        recentPayments: payments.slice(0, 50)
      }
    });

  } catch (error) {
    console.error('Error fetching admin revenue breakdown:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};