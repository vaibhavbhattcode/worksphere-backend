// server.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import passport from "passport";
import session from "express-session";
import rateLimit from "express-rate-limit";
import MongoStore from "connect-mongo";
import connectDB from "./config/db.js";
import "./config/passport.js"; // your Passport strategies

// Route imports
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profile.js";
import aiRoutes from "./routes/ai.js";
import companyAuthRoutes from "./routes/companyAuthRoutes.js";
import companyProfileRoutes from "./routes/companyProfileRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import companyDashboardRoutes from "./routes/companyDashboardRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import companyApplicationRoutes from "./routes/companyApplicationRoutes.js";
import companyListRoutes from "./routes/companyListRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { getRecommendedAndAllJobs } from "./controllers/jobController.js";
import { isUserAuthenticated } from "./middleware/userAuthMiddleware.js";

// Connect to MongoDB
connectDB();

const app = express();

// Trust proxy (required on Render, Heroku, etc.)
app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";

// Basic security headers
app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: allow local, any Vercel and any Render subdomain
const allowedOrigins = [
  /^https:\/\/[\w-]+\.vercel\.app$/, // any Vercel-hosted frontend
  /^https:\/\/[\w-]+\.onrender\.com$/, // any Render-hosted frontend
  "http://localhost:3000", // local React dev
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.some((p) =>
          typeof p === "string" ? p === origin : p.test(origin)
        )
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiter (protects against brute force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: "Too many requests, please try again later.",
});

// Cookie settings for sessions
const commonCookieSettings = {
  secure: isProduction, // HTTPS only in prod
  httpOnly: true, // JS cannot read cookie
  sameSite: isProduction ? "None" : "Lax", // cross-site in prod
  maxAge: 24 * 60 * 60 * 1000, // 1 day
};

// Session middleware for users
const userSessionMiddleware = session({
  name: "user.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "userSessions",
  }),
  proxy: true,
  cookie: commonCookieSettings,
});

// Session middleware for companies
const companySessionMiddleware = session({
  name: "company.sid",
  secret: process.env.SESSION_SECRET_COMPANY,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "companySessions",
  }),
  proxy: true,
  cookie: commonCookieSettings,
});

// Session middleware for admins
const adminSessionMiddleware = session({
  name: "admin.sid",
  secret: process.env.SESSION_SECRET_ADMIN,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "adminSessions",
  }),
  proxy: true,
  cookie: commonCookieSettings,
});

// Serve uploads with CORS for credentials
app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res) => {
      res.set(
        "Access-Control-Allow-Origin",
        process.env.FRONTEND_URL || "http://localhost:3000"
      );
      res.set("Access-Control-Allow-Credentials", "true");
    },
  })
);

// Routes mounting

// Public health check
app.get("/", (_req, res) => res.send("Work Sphere backend is running ✅"));

// Jobs recommended (user-only)
app.get(
  "/api/jobs/recommended",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  isUserAuthenticated,
  getRecommendedAndAllJobs
);

// Company-only job routes
app.use(
  "/api/jobs",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  jobRoutes
);

// Auth & user routes
app.use(
  "/api/auth",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  limiter,
  authRoutes
);
app.use(
  "/api/user",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  userRoutes
);
app.use("/api/user/profile", profileRoutes);
app.use(
  "/api/ai",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  limiter,
  aiRoutes
);
app.use(
  "/api/notifications",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  notificationRoutes
);

// Company auth & profile
app.use(
  "/api/company/auth",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  limiter,
  companyAuthRoutes
);
app.use(
  "/api/company/profile",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  companyProfileRoutes
);
app.use(
  "/api/company/dashboard",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  companyDashboardRoutes
);

// Other API routes
app.use(
  "/api/searches",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  searchRoutes
);
app.use(
  "/api/applications",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  applicationRoutes
);
app.use(
  "/api/company/applications",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  companyApplicationRoutes
);
app.use(
  "/api/company/interviews",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  interviewRoutes
);
app.use("/api/companies", companyListRoutes);
app.use("/api/company-profiles", companyProfileRoutes);
app.use("/admin/auth", adminAuthRoutes);
app.use(
  "/admin",
  adminSessionMiddleware,
  passport.initialize(),
  passport.session(),
  adminRoutes
);

// Fallback 404 for API
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API endpoint not found" });
  }
  next();
});

// Global error handler (optional)
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: err.message || "Server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
