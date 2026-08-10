//routes/adminRoutes.js
import express from "express";
import {
  getUsers,
  getUserById,
  updateRole,
  deleteUser,
  createLabForUser,
  createPharmacyForUser,
  createDoctorForUser,
  getAdminDashboardStats,
  getAllAppointments,
  getAllOrders,
  getAllLabBookings
} from "../controllers/adminController.js";
import upload from "../middleware/uploads.js";

import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// User management
router.get("/users", protect, adminOnly, getUsers);
router.get("/users/:id", protect, adminOnly, getUserById);
router.put("/users/:id/role", protect, adminOnly, updateRole);
router.delete("/users/:id", protect, adminOnly, deleteUser);

// Dashboard Stats
router.get("/stats", protect, adminOnly, getAdminDashboardStats);
router.get("/appointments", protect, adminOnly, getAllAppointments);
router.get("/orders", protect, adminOnly, getAllOrders);
router.get("/lab-bookings", protect, adminOnly, getAllLabBookings);

// Create entities
router.post(
  "/create-lab-for-user/:userId",
  protect,
  adminOnly,
  upload.single("logo"),
  createLabForUser
);

router.post(
  "/create-pharmacy-for-user/:userId",
  protect,
  adminOnly,
  upload.single("image"),
  createPharmacyForUser
);

router.post(
  "/create-doctor-for-user/:userId",
  protect,
  adminOnly,
  upload.single("image"),
  createDoctorForUser
);

export default router;
