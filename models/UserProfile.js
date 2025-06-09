// models/UserProfile.js
import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    profileImage: { type: String, default: "" },
    title: { type: String, default: "" },
    location: { type: String, default: "" },
    phone: { type: String, default: "" },
    about: { type: String, default: "" },
    // Changed from an array of strings to an array of Skill references
    skills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
    socialLinks: {
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      twitter: { type: String, default: "" },
      portfolio: { type: String, default: "" },
    },
    profileViews: { type: Number, default: 0 },
    interactions: { type: Number, default: 0 },
    viewsOverTime: { type: Array, default: [] },
    jobMatchRank: { type: Number, default: 0 },
    resume: { type: String, default: "" },
    resumeName: { type: String, default: "" },
    videoIntroduction: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("UserProfile", userProfileSchema);
