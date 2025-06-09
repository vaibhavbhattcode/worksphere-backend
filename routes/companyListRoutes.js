import express from "express";
import mongoose from "mongoose";
import Company from "../models/Company.js";
import CompanyProfile from "../models/CompanyProfile.js";

const router = express.Router();

// GET all companies using their profile data
router.get("/", async (req, res) => {
  try {
    // Retrieves all company profiles; adjust fields if needed
    const companies = await CompanyProfile.find().lean();
    res.status(200).json(companies);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET a single company's full profile for public view
router.get("/:id", async (req, res) => {
  try {
    const companyId = req.params.id;

    // Validate that the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    // Fetch core company data from the Company collection
    const company = await Company.findById(companyId).lean();
    if (!company) {
      console.error("Company not found for ID:", companyId);
      return res.status(404).json({ message: "Company not found" });
    }

    // Fetch the associated profile from the CompanyProfile collection
    const companyProfile = await CompanyProfile.findOne({
      company: company._id,
    }).lean();

    // Merge core company data with its profile data
    const data = {
      ...company,
      ...(companyProfile ? companyProfile : {}),
    };

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching company profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
