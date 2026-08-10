import express from "express";
import {
  getDoctorReviews,
  addReview,
  updateReview,
  deleteReview
} from "../controllers/docReviewController.js";

const router = express.Router();

router.get("/:doctorId", getDoctorReviews);
router.post("/:doctorId", addReview);
router.put("/:reviewId", updateReview);
router.delete("/:reviewId", deleteReview); // Add delete route

export default router;
