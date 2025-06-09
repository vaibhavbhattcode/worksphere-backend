// routes/companyAuthRoutes.js
import express from "express";
import passport from "passport";
import {
  registerCompany,
  verifyCompanyEmail,
  loginCompany,
  resendCompanyVerification,
  forgotCompanyPassword,
  resetCompanyPassword,
} from "../controllers/companyAuthController.js";
import CompanyProfile from "../models/CompanyProfile.js";

const router = express.Router();

router.post("/register", registerCompany);
router.post("/login", loginCompany);
router.get("/verify-email", verifyCompanyEmail);
router.post("/resend-verification", resendCompanyVerification);
router.post("/forgot-password", forgotCompanyPassword);
router.post("/reset-password", resetCompanyPassword);

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err)
      return res.status(500).json({ message: "Logout failed", error: err });
    req.session.destroy((err) => {
      if (err)
        return res.status(500).json({ message: "Error clearing session" });
      res.clearCookie("company.sid");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
});

// Updated status endpoint to fetch profile details if authenticated.
router.get("/status", async (req, res) => {
  if (req.user) {
    try {
      const companyProfile = await CompanyProfile.findOne({
        company: req.user._id,
      });
      return res.json({
        loggedIn: true,
        type: "company",
        company: {
          ...req.user.toObject(),
          ...(companyProfile ? companyProfile.toObject() : {}),
        },
      });
    } catch (error) {
      console.error("Error fetching company profile:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
  return res.json({ loggedIn: false, type: null });
});

router.get(
  "/google",
  passport.authenticate("google-company", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google-company", {
    failureRedirect: process.env.FRONTEND_URL + "/company/login",
  }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/company/dashboard`);
  }
);

export default router;
