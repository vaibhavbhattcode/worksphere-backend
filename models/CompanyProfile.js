// models/CompanyProfile.js
import mongoose from "mongoose";

const companyProfileSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyName: { type: String, required: true },
    tagline: { type: String, default: "" },
    phone: { type: String, required: true },
    companyAddress: { type: String, required: true },
    website: { type: String, default: "" },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    industry: { type: String, default: "" },
    headquarters: { type: String, default: "" },
    companyType: { type: String, default: "" },
    companySize: { type: String, default: "" },
    founded: { type: String, default: "" },
    specialties: { type: [String], default: [] },
    mission: { type: String, default: "" },
    vision: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("CompanyProfile", companyProfileSchema);
