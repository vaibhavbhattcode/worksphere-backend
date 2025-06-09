// routes/applicationRoutes.js
import express from "express";
import {
  submitApplication,
  getApplicationsForJob,
  getUserApplication,
  getAllUserApplications,
  getAppliedJobs,
} from "../controllers/applicationController.js";
import { isUserAuthenticated } from "../middleware/userAuthMiddleware.js";

const router = express.Router();

router.get("/my", isUserAuthenticated, getAllUserApplications);
router.get("/my/:jobId", isUserAuthenticated, getUserApplication);
router.post("/", isUserAuthenticated, submitApplication);
router.get("/applied", isUserAuthenticated, getAppliedJobs);
router.get("/:jobId", isUserAuthenticated, getApplicationsForJob);

export default router;
