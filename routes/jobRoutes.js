// routes/jobRoutes.js

import express from "express";
import {
  createJob,
  getPostedJobs,
  getJobDetails,
  updateJob,
  updateJobStatus,
  getJobApplicants,
  deleteJob,
  getJobs,
  getJobsByCompanyId,
  getRecommendedAndAllJobs,
} from "../controllers/jobController.js";
import { getJobCategories } from "../controllers/jobCategoriesController.js";
import { isCompanyAuthenticated } from "../middleware/companyAuthMiddleware.js";
import { isUserAuthenticated } from "../middleware/userAuthMiddleware.js";

const router = express.Router();

// — Public endpoints —
router.get("/", getJobs);
router.get("/company/jobs/:companyId", getJobsByCompanyId);
router.get("/categories", getJobCategories);

// ** Must come BEFORE “/:jobId” so “recommended” isn’t treated as an ID **
// Returns a single array of all jobs, each with isRecommended flag, sorted with recommended first.
router.get("/recommended", isUserAuthenticated, getRecommendedAndAllJobs);

// — Company-only endpoints —
router.get("/posted", isCompanyAuthenticated, getPostedJobs);
router.post("/", isCompanyAuthenticated, createJob);
router.put("/:jobId", isCompanyAuthenticated, updateJob);
router.patch("/:jobId/status", isCompanyAuthenticated, updateJobStatus);
router.delete("/:jobId", isCompanyAuthenticated, deleteJob);

// Now that "/recommended" is defined, this “/:jobId” will only match real ObjectIds
router.get("/:jobId", getJobDetails);
router.get("/:jobId/applicants", isCompanyAuthenticated, getJobApplicants);

export default router;
