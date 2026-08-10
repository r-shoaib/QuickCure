// routes/paymentRoutes.js
import express from 'express';
import {
  createPaymentIntent,
  confirmPayment,
  handleStripeWebhook,
  getPaymentStatus,
  getCommissionReport
} from '../controllers/stripePaymentController.js';

const router = express.Router();

// Stripe webhook endpoint - must be raw body, BEFORE express.json()
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Public routes
router.post('/create-payment-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.get('/status', getPaymentStatus);

// Admin routes
router.get('/commission-report', getCommissionReport);

export default router;