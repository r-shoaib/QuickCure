import express from 'express';
import {
  technicianLogin,
  getTechnicianDashboard,
  updateBookingStatus,
  notifyLabAdmin,
  getTechnicianProfile,
  updateTechnicianProfile
} from '../controllers/technicianController.js';
import { auth, authorize } from '../middleware/authmiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', technicianLogin);

// Protected routes (technician only)
router.get('/dashboard', auth, authorize('technician'), getTechnicianDashboard);
router.patch('/booking/:bookingId/status', auth, authorize('technician'), updateBookingStatus);
router.post('/booking/:bookingId/notify-admin', auth, authorize('technician'), notifyLabAdmin);
router.get('/profile', auth, authorize('technician'), getTechnicianProfile);
router.patch('/profile', auth, authorize('technician'), updateTechnicianProfile);

export default router;