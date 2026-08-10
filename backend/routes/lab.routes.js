import express from "express";
import upload from "../middleware/uploads.js";
import {
  createLab,
  getLabs,
  getLabById,
  updateLab,
  deleteLab,
} from "../controllers/labController.js";

const router = express.Router();


router.get("/", getLabs);
router.get("/:id", getLabById);
router.put("/:id", upload.single("logo"), updateLab);
router.delete("/:id", deleteLab);

router.post("/", createLab);

export default router;
