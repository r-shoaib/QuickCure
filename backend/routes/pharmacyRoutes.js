import express from 'express';
import {
  // Pharmacy functions
  getPharmacies,
  getPharmacyById,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
  getPharmacyStats,
  getCities,
  getNearbyPharmacies,
  
  // Pharmacy medicine functions
  getPharmacyMedicines,
  getMedicineFromPharmacy,
  addMedicineToPharmacy,
  updateMedicineInPharmacy,
  removeMedicineFromPharmacy,
  
  // Aggregated medicine functions
  getAllMedicines,
  getMedicineByName,
  getMedicineCategories,
  getMedicineStats,
  
  // Admin approval
  approvePharmacy,
  rejectPharmacy
} from '../controllers/pharmacyController.js';

// Import dashboard routes
import dashboardRoutes from './pharmacyDashboardRoutes.js';

const router = express.Router();

// ========================
// PUBLIC ROUTES (Static routes BEFORE parameterized routes)
// ========================

// 0. STATIC MEDICINE ROUTES (must come before /:id to avoid route conflict)
router.get('/medicines/all', getAllMedicines);
router.get('/medicines/categories', getMedicineCategories);
router.get('/medicines/stats', getMedicineStats);
router.get('/medicines/:name', getMedicineByName);

// 1. PHARMACY ROUTES
router.get('/', getPharmacies);
router.get('/nearby', getNearbyPharmacies);
router.get('/stats', getPharmacyStats);
router.get('/cities', getCities);
router.get('/:id', getPharmacyById);

// 2. PHARMACY-SPECIFIC MEDICINE ROUTES
router.get('/:id/medicines', getPharmacyMedicines);
router.get('/:pharmacyId/medicines/:medicineId', getMedicineFromPharmacy);

// ========================
// DASHBOARD ROUTES
// ========================

// Mount all dashboard routes
router.use('/dashboard', dashboardRoutes);

// ========================
// ADMIN ROUTES
// ========================

// Pharmacy CRUD
router.post('/', createPharmacy);           // For pharmacy registration
router.put('/:id', updatePharmacy);
router.delete('/:id', deletePharmacy);

// Pharmacy approval
router.put('/:id/approve', approvePharmacy);
router.put('/:id/reject', rejectPharmacy);

// Medicine CRUD
router.post('/:id/medicines', addMedicineToPharmacy);
router.put('/:pharmacyId/medicines/:medicineId', updateMedicineInPharmacy);
router.delete('/:pharmacyId/medicines/:medicineId', removeMedicineFromPharmacy);

export default router;

