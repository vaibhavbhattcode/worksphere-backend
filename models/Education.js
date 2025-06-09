// models/Education.js
import mongoose from "mongoose";

const educationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    institution: { type: String },
    degree: { type: String },
    year: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Education", educationSchema);
