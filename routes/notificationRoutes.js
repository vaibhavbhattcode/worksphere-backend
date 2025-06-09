// routes/notificationRoutes.js
import express from "express";
import {
  getUserNotifications,
  markAsRead,
  clearAllNotifications,
} from "../controllers/notificationController.js";
import { isUserAuthenticated } from "../middleware/userAuthMiddleware.js";

const router = express.Router();

// GET all
router.get("/", isUserAuthenticated, getUserNotifications);

// PATCH mark as read
router.patch("/:id/read", isUserAuthenticated, markAsRead);

// DELETE all
router.delete("/", isUserAuthenticated, clearAllNotifications);

export default router;
