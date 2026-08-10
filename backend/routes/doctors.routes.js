import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  addDoctor,
  getAllDoctors,
  getDoctor,
  getDoctorByUserId,
  updateDoctor,
  deleteDoctor,
  getDoctorsBySpeciality,
  updateAvailability,
  searchDoctors,
  getDoctorAvailability,
  getAvailableToday,
  updateDoctorRating
} from "../controllers/doctorsController.js";

const router = express.Router();

// Get current directory for file uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif)'));
    }
  }
});

// Public routes
router.get("/", getAllDoctors);
router.get("/search", searchDoctors);
router.get("/available-today", getAvailableToday);
router.get("/speciality/:speciality", getDoctorsBySpeciality);
router.get("/user/:userId", getDoctorByUserId);
router.get("/:id", getDoctor);
router.get("/:id/availability", getDoctorAvailability);

// Protected routes (require authentication middleware in production)
router.post("/", upload.single("image"), addDoctor);
router.put("/:id", upload.single("image"), updateDoctor);
router.delete("/:id", deleteDoctor);

// Availability management
router.put("/:id/availability", updateAvailability);

// Rating update (usually called internally from reviews service)
router.put("/:id/rating", updateDoctorRating);

export default router;