import express from 'express';
import { 
  checkEmailExists, 
  checkLicenseNumber,
  checkCnicExists,
  submitRegistration,
  getProvinces,
  getCitiesByProvince,
  getRegistrationById,
  getAllRegistrations,
  updateRegistrationStatus,
  deleteRegistration,
  getStats
} from '../controllers/pharmacyReg.controller.js';
import { validatePharmacyRegistration } from '../middleware/pharmacyValidation.js';
import upload from '../middleware/uploads.js';

const router = express.Router();

// Public routes
router.get('/check-email', checkEmailExists);
router.get('/check-license', checkLicenseNumber);
router.get('/check-cnic', checkCnicExists);
router.get('/provinces', getProvinces);
router.get('/cities/:provinceId', getCitiesByProvince);

// Registration submission with file uploads
router.post(
  '/submit',
  upload.fields([
    { name: 'licenseFile', maxCount: 1 },
    { name: 'taxCertificate', maxCount: 1 },
    { name: 'ownerIdProof', maxCount: 1 }
  ]),
  validatePharmacyRegistration,
  submitRegistration
);

// Admin routes (would normally be protected with authentication)
router.get('/stats', getStats);
router.get('/all', getAllRegistrations);
router.get('/:id', getRegistrationById);
router.put('/:id/status', updateRegistrationStatus);
router.delete('/:id', deleteRegistration);

export default router;