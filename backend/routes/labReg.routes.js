import express from 'express';
import { 
  getExistingEmails, 
  checkEmailExists, 
  checkRegistrationNumber,
  submitRegistration,
  getProvinces,
  getCitiesByProvince,
  getLocationData,
  getRegistrationById,
  getAllRegistrations,
  updateRegistrationStatus,
  deleteRegistration,
  getStats
} from '../controllers/labReg.controller.js';
import { validateLabRegistration, validateEmailCheck } from '../middleware/validation.js';
import upload from '../middleware/uploads.js';

const router = express.Router();

// Public routes
router.get('/existing-emails', getExistingEmails);
router.get('/check-email', checkEmailExists);
router.get('/check-registration', checkRegistrationNumber);
router.get('/provinces', getProvinces);
router.get('/cities/:provinceId', getCitiesByProvince);
router.get('/location-data', getLocationData);

// Registration submission with file uploads
router.post(
  '/submit',
  upload.fields([
    { name: 'registrationCertificate', maxCount: 1 },
    { name: 'cnicFront', maxCount: 1 },
    { name: 'cnicBack', maxCount: 1 }
  ]),
  validateLabRegistration,
  submitRegistration
);

// Admin routes (would normally be protected with authentication)
router.get('/stats', getStats);
router.get('/all', getAllRegistrations);
router.get('/:id', getRegistrationById);
router.put('/:id/status', updateRegistrationStatus);
router.delete('/:id', deleteRegistration);

export default router;