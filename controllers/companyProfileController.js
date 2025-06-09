// controllers/companyProfileController.js
import CompanyProfile from "../models/CompanyProfile.js";
import Job from "../models/Job.js"; // Ensure Job model is imported
import Joi from "joi";
import multer from "multer";
import path from "path";
import fs from "fs";

// Joi schema for validation (unchanged)
const companyProfileSchema = Joi.object({
  companyName: Joi.string().min(2).required().messages({
    "string.min": "Company Name must be at least 2 characters long",
    "any.required": "Company Name is required",
  }),
  tagline: Joi.string().allow(""),
  description: Joi.string().allow(""),
  industry: Joi.string().allow("").required().messages({
    "any.required": "Industry is required",
  }),
  website: Joi.string().uri().allow(""),
  headquarters: Joi.string().allow(""),
  companyType: Joi.string().allow("").required().messages({
    "any.required": "Company Type is required",
  }),
  companySize: Joi.string().allow("").required().messages({
    "any.required": "Company Size is required",
  }),
  founded: Joi.string()
    .pattern(/^\d{4}$/)
    .allow("")
    .messages({
      "string.pattern.base": "Founded must be a valid 4-digit year",
    }),
  specialties: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string())
    .optional(),
  contactEmail: Joi.string().email().required().messages({
    "string.email": "Invalid email format",
    "any.required": "Contact Email is required",
  }),
  contactPhone: Joi.string().allow(""),
  mission: Joi.string().allow(""),
  vision: Joi.string().allow(""),
});

// Fetch company profile (unchanged)
export const getCompanyProfile = async (req, res) => {
  try {
    let companyProfile = await CompanyProfile.findOne({
      company: req.user._id,
    });
    if (!companyProfile) {
      companyProfile = new CompanyProfile({
        company: req.user._id,
        companyName: req.user.companyName || "Your Company Name",
        phone: "",
        tagline: "",
        description: "",
        industry: "",
        website: "",
        headquarters: req.user.companyAddress || "",
        companyAddress: req.user.companyAddress || "",
        companyType: "",
        companySize: "",
        founded: "",
        specialties: [],
      });
      await companyProfile.save();
    } else if (!companyProfile.headquarters && companyProfile.companyAddress) {
      companyProfile.headquarters = companyProfile.companyAddress;
      await companyProfile.save();
    }

    const profileData = companyProfile.toObject();
    profileData.contactEmail = req.user.email;
    profileData.contactPhone = profileData.phone;
    res.json(profileData);
  } catch (error) {
    console.error("Error fetching company profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update company profile (unchanged)
export const updateCompanyProfile = async (req, res) => {
  try {
    const { error, value } = companyProfileSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const messages = error.details.map((detail) => detail.message).join(", ");
      return res.status(400).json({ message: messages });
    }
    if (typeof value.specialties === "string") {
      value.specialties = value.specialties
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
    }
    if (value.contactEmail) {
      value.email = value.contactEmail.toLowerCase();
      delete value.contactEmail;
    }
    if (value.contactPhone) {
      value.phone = value.contactPhone;
      delete value.contactPhone;
    }
    const updatedProfile = await CompanyProfile.findOneAndUpdate(
      { company: req.user._id },
      value,
      { new: true, runValidators: true }
    );
    const updatedData = updatedProfile.toObject();
    updatedData.contactEmail = req.user.email;
    updatedData.contactPhone = updatedData.phone;
    res.json(updatedData);
  } catch (error) {
    console.error("Error updating company profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Multer setup for logo upload (unchanged)
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = "uploads/logos";
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `logo-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("logo");

// Upload company logo (unchanged)
export const uploadCompanyLogo = async (req, res) => {
  logoUpload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const logoUrl = `/uploads/logos/${req.file.filename}`;
      const updatedProfile = await CompanyProfile.findOneAndUpdate(
        { company: req.user._id },
        { logo: logoUrl },
        { new: true, runValidators: true }
      );
      return res.json({
        message: "Logo uploaded successfully",
        logo: updatedProfile.logo,
      });
    } catch (error) {
      console.error("Error updating logo:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });
};

// Fetch oldest companies with active job counts (corrected)
export const getOldestCompanies = async (req, res) => {
  try {
    // Fetch the 4 oldest companies sorted by 'createdAt'
    const companies = await CompanyProfile.find()
      .sort({ createdAt: 1 })
      .limit(4);

    if (companies.length === 0) {
      return res.status(404).json({ message: "No companies found" });
    }

    // Calculate active job count for each company
    const companiesWithJobCount = await Promise.all(
      companies.map(async (company) => {
        const activeJobCount = await Job.countDocuments({
          companyId: company.company, // Use the Company reference from CompanyProfile
          status: "Open", // Only count jobs with status "Open"
        });

        return {
          ...company.toObject(),
          totalActiveJobs: activeJobCount, // Explicitly named for clarity
        };
      })
    );

    res.status(200).json(companiesWithJobCount);
  } catch (error) {
    console.error("Error fetching oldest companies:", error);
    res.status(500).json({ message: "Server error" });
  }
};
