import express from "express";
import {
  scheduleInterview,
  getInterviewsByJob,
  cancelInterview,
} from "../controllers/interviewController.js";
import { isCompanyAuthenticated } from "../middleware/companyAuthMiddleware.js";

const router = express.Router();

// Schedule or Reschedule Interview
router.post("/", isCompanyAuthenticated, scheduleInterview);

// Fetch Interviews by Job
router.get("/job/:jobId", isCompanyAuthenticated, getInterviewsByJob);

// Cancel Interview
router.delete("/:interviewId", isCompanyAuthenticated, cancelInterview);

export default router;
