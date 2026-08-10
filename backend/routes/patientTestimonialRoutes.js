// routes/patientTestimonialRoutes.js
import express from 'express';
import {
  getTestimonials,
  createTestimonial,
  getAverageRating,
  deleteTestimonial
} from '../controllers/patientTestimonialController.js';

const router = express.Router();

// Different route path to avoid conflict with doctor reviews
router.route('/')
  .get(getTestimonials)
  .post(createTestimonial);

router.get('/average', getAverageRating);
router.delete('/:id', deleteTestimonial);

export default router;