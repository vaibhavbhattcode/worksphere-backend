// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, select: false },
    googleId: { type: String },
    role: {
      type: String,
      enum: ["jobSeeker", "employer", "admin"],
      default: "jobSeeker",
    },
    isVerified: { type: Boolean, default: false },
    authMethod: { type: String, enum: ["local", "google"], default: "local" },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    mobileVerified: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
