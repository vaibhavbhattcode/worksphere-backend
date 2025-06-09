// routes/companyDashboardRoutes.js
import express from "express";
import { getDashboardOverview } from "../controllers/companyDashboardController.js";
import { isCompanyAuthenticated } from "../middleware/companyAuthMiddleware.js";

const router = express.Router();

router.get("/overview", isCompanyAuthenticated, getDashboardOverview);

export default router;
