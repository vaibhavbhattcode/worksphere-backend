// models/Experience.js
import mongoose from "mongoose";

const experienceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: String },
    position: { type: String },
    start: { type: String },
    end: { type: String },
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Experience", experienceSchema);
