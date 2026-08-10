import express from "express";
import  upload  from "../middleware/uploads.js";
import {
  addSpecialty,
  getSpecialties,
  getSpecialty,
  deleteSpecialty,
  updateSpecialty,
} from "../controllers/specialtyController.js";

const router = express.Router();

// Add new specialty (with image upload)
router.post("/add", upload.single("icon"), addSpecialty);

// Get all specialties
router.get("/", getSpecialties);

// Get one specialty
router.get("/:id", getSpecialty);

// Delete specialty
router.delete("/:id", deleteSpecialty);

//Update specialty
router.put("/:id", updateSpecialty);
export default router;
