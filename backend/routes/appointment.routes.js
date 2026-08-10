
import express from "express";
import {
  getAvailableSlots,
  bookAppointment,
  getAppointment,
  cancelAppointment,
  getAppointmentsByPhone,
  updateAppointmentStatus,
  getDoctorAppointments,
  getDoctorPatients,
  sendMeetLink
} from "../controllers/appointmentController.js";

const router = express.Router();

// Public routes
router.get("/slots", getAvailableSlots);
router.post("/book", bookAppointment);
router.get("/appointment", getAppointment);
router.get("/phone/:phoneNo", getAppointmentsByPhone);

// Protected routes
router.put("/:id/cancel", cancelAppointment);
router.put("/:id/status", updateAppointmentStatus);
router.put("/:id/send-meet-link", sendMeetLink);
router.get("/doctor/:doctorId", getDoctorAppointments);
router.get("/doctor/:doctorId/patients", getDoctorPatients);

export default router;