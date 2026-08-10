import express from "express";
import {
  createTest,
  getTestsByLab,
  getTestById,
  updateTest,
  deleteTest,
} from "../controllers/testController.js";

const router = express.Router();

router.post("/", createTest);
router.get("/lab/:labId", getTestsByLab);
router.get("/:id", getTestById);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

export default router;
