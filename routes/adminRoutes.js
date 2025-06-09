import express from "express";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";

import adminController from "../controllers/adminController.js";
import adminDashboardController from "../controllers/adminDashboardController.js";

const router = express.Router();

// Admin Dashboard Stats
router.get("/stats", adminAuthMiddleware, adminController.getStats);

// User Management
router.get("/users", adminAuthMiddleware, adminController.getAllUsers);
router.put("/users/:id", adminAuthMiddleware, adminController.updateUser);
router.delete("/users/:id", adminAuthMiddleware, adminController.deleteUser);
router.patch(
  "/users/:id/toggle-active",
  adminAuthMiddleware,
  adminController.toggleUserActive
); // Add this route
router.patch(
  "/users/bulk-toggle-active",
  adminAuthMiddleware,
  adminController.bulkToggleUsersActive
);

// Company Management
router.get("/companies", adminAuthMiddleware, adminController.getAllCompanies);
router.get(
  "/companies/:id/details",
  adminAuthMiddleware,
  adminController.getCompanyDetails
);
router.put(
  "/companies/:id",
  adminAuthMiddleware,
  adminController.updateCompany
);
router.delete(
  "/companies/:id",
  adminAuthMiddleware,
  adminController.deleteCompany
);
router.patch(
  "/companies/:id/toggle-active",
  adminAuthMiddleware,
  adminController.toggleCompanyActive
);
router.patch(
  "/companies/bulk-toggle-active",
  adminAuthMiddleware,
  adminController.bulkToggleCompaniesActive
);

// Job Management
router.get("/jobs", adminAuthMiddleware, adminController.getAllJobs);
router.put("/jobs/:id", adminAuthMiddleware, adminController.updateJob);
router.delete("/jobs/:id", adminAuthMiddleware, adminController.deleteJob);

// User Growth
router.get("/user-growth", adminAuthMiddleware, adminController.getUserGrowth);

// Job Stats
router.get("/job-stats", adminAuthMiddleware, adminController.getJobStats);

// Company Stats
router.get(
  "/company-stats",
  adminAuthMiddleware,
  adminController.getCompanyStats
);

// Job Trends
router.get("/job-trends", adminAuthMiddleware, adminController.getJobTrends);

export default router;
