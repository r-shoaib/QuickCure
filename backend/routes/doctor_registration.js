
import express from 'express';
import drRegUpload from '../middleware/dr_reg_upload.js';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  registerDoctor,
  getAllRegistrations,
  getRegistrationById,
  checkRegistrationStatus,
  updateRegistrationStatus,
  deleteRegistration,
  getRegistrationStats,
  checkCNICExists,
  checkLicenseExists
} from '../controllers/doctorRegistration.controller.js';

const router = express.Router();

// Configure multer for multiple file uploads
const uploadFields = drRegUpload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 },
  { name: 'doctorLicense', maxCount: 1 },
  { name: 'mbbsCertificate', maxCount: 1 },
  { name: 'houseJobCertificate', maxCount: 1 },
  { name: 'specializationCertificate', maxCount: 1 },
  { name: 'fcpsCertificate', maxCount: 1 }
]);

// Public routes
router.post('/register', uploadFields, registerDoctor);
router.get('/check-status', checkRegistrationStatus);

// NEW: Check if CNIC exists (public route for registration validation)
router.get('/check-cnic/:cnic', checkCNICExists);

// NEW: Check if License Number exists (public route for registration validation)
router.get('/check-license/:licenseNumber', checkLicenseExists);

// Admin routes (protected)
router.get('/registrations', protect, adminOnly, getAllRegistrations);
router.get('/registrations/:id', protect, adminOnly, getRegistrationById);
router.patch('/registrations/:id/status', protect, adminOnly, updateRegistrationStatus);
router.delete('/registrations/:id', protect, adminOnly, deleteRegistration);
router.get('/stats', protect, adminOnly, getRegistrationStats);

export default router;