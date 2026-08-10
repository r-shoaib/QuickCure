import express from "express";
import {
  createPrescription,
  getDoctorPrescriptions,
  getPrescriptionsByPhone,
  getPrescriptionById,
  updatePrescription,
  deletePrescription,
  getPatientPrescriptions,
  uploadPrescriptionFile
} from "../controllers/prescriptionController.js";
import upload from "../middleware/uploads.js";

const router = express.Router();

// Public routes
router.post("/", createPrescription);
router.get("/doctor/:doctorId", getDoctorPrescriptions);
router.get("/phone/:phone", getPrescriptionsByPhone);
router.get("/patient/:patientEmail", getPatientPrescriptions);
router.get("/:id", getPrescriptionById);
router.put("/:id", updatePrescription);
router.delete("/:id", deletePrescription);

// Upload a prescription file (attach to existing prescription)
router.post("/upload", upload.single("prescriptionFile"), uploadPrescriptionFile);

export default router;
