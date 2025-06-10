// server.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import passport from "passport";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import MongoStore from "connect-mongo";
import connectDB from "./config/db.js";
import "./config/passport.js";

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

connectDB();

const app = express();
app.set("trust proxy", 1); // ✅ Add this line

const isProduction = process.env.NODE_ENV === "production";

app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://worksphere-beige.vercel.app", // fallback
  "http://localhost:3000", // for local dev
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true, // ✅ required for cookie/session

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
console.log("Running in production?", isProduction); // Add this line to be 100% sure

const commonCookieSettings = {
  secure: isProduction,
  httpOnly: true,
  sameSite: isProduction ? "None" : "Lax",
  maxAge: 24 * 60 * 60 * 1000,
};

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: "Too many requests, please try again later.",
});

// ───────────────────────────────────────────────────────────────────────────
// Session middleware for “users” (end‐users)
const userSessionMiddleware = session({
  name: "user.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "userSessions",
  }),
  cookie: commonCookieSettings,
});

// Session middleware for “companies”
const companySessionMiddleware = session({
  name: "company.sid",
  secret: process.env.SESSION_SECRET_COMPANY,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "companySessions",
  }),
  cookie: commonCookieSettings,
});

// Session middleware for “admins”
const adminSessionMiddleware = session({
  name: "admin.sid",
  secret: process.env.SESSION_SECRET_ADMIN,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "adminSessions",
  }),
  cookie: commonCookieSettings,
});

// ───────────────────────────────────────────────────────────────────────────
// 1) EXPOSE “/api/jobs/recommended” under userSessionMiddleware
//    so that req.user is populated for logged‐in users
app.get(
  "/api/jobs/recommended",
  userSessionMiddleware,
  passport.initialize(),
  passport.session(),
  isUserAuthenticated,
  getRecommendedAndAllJobs
);

// ───────────────────────────────────────────────────────────────────────────
// 2) Mount all other /api/jobs routes (company‐only endpoints)
app.use(
  "/api/jobs",
  companySessionMiddleware,
  passport.initialize(),
  passport.session(),
  jobRoutes
);

// ───────────────────────────────────────────────────────────────────────────
// 3) Other routes
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

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(
    `Request URL: ${req.url}, Method: ${req.method}, Body: ${JSON.stringify(
      req.body
    )}`
  );
  next();
});
// 🔥 Health check route
app.get("/", (req, res) => {
  res.send("Work Sphere backend is running ✅");
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
