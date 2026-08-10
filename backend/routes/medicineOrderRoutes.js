import express from 'express';
import upload from '../middleware/uploads.js';
import {
  createOrder,
  getOrders,
  getOrderById,
  getOrdersByPatient,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getOrderStats,
  getPharmacyOrders,
  uploadPrescription
} from '../controllers/medicineOrderController.js';

const router = express.Router();

// Public routes
router.post('/', upload.single('prescription'), createOrder);
router.get('/patient/:email', getOrdersByPatient);
router.get('/user/:userId', getOrdersByPatient); // Alias for user ID based fetching
router.post('/:id/prescription', upload.single('prescription'), uploadPrescription);

// Pharmacy routes
router.get('/pharmacy/:pharmacyId', getPharmacyOrders);

// Protected routes
router.get('/', getOrders);
router.get('/stats', getOrderStats);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);
router.put('/:id/payment', updatePaymentStatus);
router.put('/:id/cancel', cancelOrder);

export default router;
