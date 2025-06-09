// routes/companyApplicationRoutes.js
import express from "express";
import {
  getJobApplications,
  updateApplicationStatus,
  getAllApplicationsForCompany, // NEW endpoint added in controller
} from "../controllers/companyApplicationController.js";
import { isCompanyAuthenticated } from "../middleware/companyAuthMiddleware.js";

const router = express.Router();

// Get applications for a single job
router.get("/:jobId", isCompanyAuthenticated, getJobApplications);

// NEW: Get all applications for all jobs posted by the company
router.get("/all", isCompanyAuthenticated, getAllApplicationsForCompany);

// Update application status (hired/rejected)
router.put(
  "/:applicationId/status",
  isCompanyAuthenticated,
  updateApplicationStatus
);

export default router;
