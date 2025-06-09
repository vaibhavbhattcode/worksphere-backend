// routes/companyProfileRoutes.js
import express from "express";
import {
  getCompanyProfile,
  getOldestCompanies,
  updateCompanyProfile,
  uploadCompanyLogo,
} from "../controllers/companyProfileController.js";
import { isCompanyAuthenticated } from "../middleware/companyAuthMiddleware.js";

const router = express.Router();

// Company authenticated routes
router.get("/", isCompanyAuthenticated, getCompanyProfile);
router.put("/", isCompanyAuthenticated, updateCompanyProfile);
router.post("/logo", isCompanyAuthenticated, uploadCompanyLogo);

// Public route for oldest companies
router.get("/oldest", getOldestCompanies);

export default router;
