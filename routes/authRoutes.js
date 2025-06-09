// routes/authRoutes.js
import express from "express";
import passport from "passport";
import {
  registerUser,
  verifyEmail,
  loginUser,
} from "../controllers/authController.js";

const router = express.Router();

// Registration route for local signup
router.post("/register", registerUser);

// Login route using passport local strategy for users
router.post("/login", (req, res, next) => {
  passport.authenticate("local-user", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ message: info.message || "Login failed" });
    }
    req.login(user, (err) => {
      if (err) return next(err);
      return res.json({ message: "Login successful", user });
    });
  })(req, res, next);
});

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    req.session.destroy((err) => {
      if (err)
        return res.status(500).json({ message: "Session destruction failed" });
      res.clearCookie("user.sid");
      return res.json({ message: "Logged out successfully" });
    });
  });
});

router.get("/status", (req, res) => {
  if (req.user && req.user.role === "jobSeeker") {
    return res.json({ loggedIn: true, type: "user", user: req.user });
  }
  return res.json({ loggedIn: false, type: null });
});

// Google login routes (if needed)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", (err, user, info) => {
      if (err) {
        if (err.message === "User account is deactivated. Please contact support.") {
          const redirectUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=UserDeactivated`;
          return res.redirect(redirectUrl);
        }
        return res.status(500).send("Authentication error");
      }
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login`);
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).send("Login error");
        }
        return res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
      });
    })(req, res, next);
  }
);

// Email verification route
router.get("/verify-email", verifyEmail);

export default router;
