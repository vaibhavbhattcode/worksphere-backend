// routes/userRoutes.js
import express from "express";
import {
  getProfile,
  updateProfile,
  uploadPhoto,
  uploadResume,
  removeResume,
  uploadCertificate,
  deleteCertificate,
  certificateUpload,
  uploadVideoIntro,
  deleteVideoIntro,
  getAnalytics,
  getUserDashboardOverview,
} from "../controllers/userController.js";
import {
  saveJob,
  removeSavedJob,
  getSavedJobs,
} from "../controllers/savedJobController.js";
import { isUserAuthenticated } from "../middleware/userAuthMiddleware.js";

const router = express.Router();

const requireUser = (req, res, next) => {
  if (req.user) return next();
  return res.status(401).json({ message: "Not authenticated" });
};

router.get("/overview", getUserDashboardOverview);

router.get("/profile", requireUser, getProfile);
router.put("/profile", requireUser, updateProfile);
router.post("/profile/upload-photo", requireUser, uploadPhoto);
router.post("/profile/upload-resume", requireUser, uploadResume);
router.delete("/profile/resume", requireUser, removeResume);
router.post(
  "/profile/upload-certificate",
  requireUser,
  certificateUpload.single("certificate"),
  uploadCertificate
);
router.delete(
  "/profile/certificate/:certificateId",
  requireUser,
  deleteCertificate
);

router.post("/profile/upload-video-intro", requireUser, uploadVideoIntro);
router.delete("/profile/video-intro", requireUser, deleteVideoIntro);
router.get("/analytics", requireUser, getAnalytics);

// Route to save a job
router.post("/save-job/:jobId", isUserAuthenticated, saveJob);

// Route to remove a saved job
router.delete("/remove-job/:jobId", isUserAuthenticated, removeSavedJob);

// Route to fetch saved jobs
router.get("/saved-jobs", isUserAuthenticated, getSavedJobs);

export default router;
