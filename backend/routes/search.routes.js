import express from "express";
import { unifiedSearch, getSearchSuggestions } from "../controllers/searchController.js";

const router = express.Router();

// Get search suggestions
router.get("/suggestions", getSearchSuggestions);

// Unified search endpoint
router.get("/", unifiedSearch);

export default router;
