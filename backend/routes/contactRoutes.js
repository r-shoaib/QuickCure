import express from 'express';
import { 
  submitContactForm, 
  getAllContacts, 
  getContactById,
  deleteContact 
} from '../controllers/contactController.js';

const router = express.Router();

// Public route - Submit contact form
router.post('/submit', submitContactForm);

// Admin routes (Add authentication middleware in production)
router.get('/all', getAllContacts);
router.get('/:id', getContactById);
router.delete('/:id', deleteContact);

export default router;