// routes/profile.js
import express from "express";
import { getProfile } from "../controllers/userController.js"; // Use the real controller

const router = express.Router();

// Use the real controller to fetch profile details
router.get("/:id", getProfile);

export default router;
