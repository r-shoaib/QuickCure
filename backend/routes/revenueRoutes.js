// routes/revenueRoutes.js
import express from 'express';
import { getProviderRevenue, getAdminRevenueBreakdown } from '../controllers/revenueController.js';

const router = express.Router();

// Provider revenue (for lab/doctor/pharmacy dashboards)
router.get('/provider/:providerType/:providerId', getProviderRevenue);

// Admin revenue breakdown
router.get('/admin/breakdown', getAdminRevenueBreakdown);

export default router;