// controllers/userController.js
import Job from "../models/Job.js";
import Company from "../models/Company.js";
import Application from "../models/Application.js";

import UserProfile from "../models/UserProfile.js";
import Experience from "../models/Experience.js";
import Education from "../models/Education.js";
import Certificate from "../models/Certificate.js";
import Skill from "../models/Skill.js"; // Import the new Skill model
import multer from "multer";
import fs from "fs";
import path from "path";
import Joi from "joi";

// ----------------------------------
// Joi Validation Schema
// ----------------------------------
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).required(),
  title: Joi.string().required(),
  location: Joi.string().required(),
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .allow("")
    .optional(),

  about: Joi.string().allow(""),
  experience: Joi.array().items(
    Joi.object({
      company: Joi.string().allow(""),
      position: Joi.string().allow(""),
      start: Joi.string().allow(""),
      end: Joi.string().allow(""),
      description: Joi.string().allow(""),
    })
  ),
  education: Joi.array().items(
    Joi.object({
      institution: Joi.string().allow(""),
      degree: Joi.string().allow(""),
      year: Joi.string().allow(""),
    })
  ),
  skills: Joi.array().items(Joi.string()).default([]),
  linkedin: Joi.string().uri().allow(""),
  github: Joi.string().uri().allow(""),
  twitter: Joi.string().uri().allow(""),
  portfolio: Joi.string().uri().allow(""),
});

// ----------------------------------
// GET and UPDATE PROFILE
// ----------------------------------
export const getProfile = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user._id }).populate(
      "skills"
    );
    if (!profile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    // Fetch related documents
    const experiences = await Experience.find({ user: req.user._id });
    const education = await Education.find({ user: req.user._id });
    const certificates = await Certificate.find({ user: req.user._id });

    const profileData = profile.toObject();
    // Convert populated skills to an array of skill names
    profileData.skills = profile.skills
      ? profile.skills.map((skill) => skill.name)
      : [];
    profileData.experience = experiences;
    profileData.education = education;
    profileData.certificates = certificates;
    profileData.email = req.user.email; // Always attach email from the user session

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const {
      name,
      title,
      location,
      phone,
      about,
      skills,
      linkedin,
      github,
      twitter,
      portfolio,
    } = value;

    const socialLinks = {
      linkedin: linkedin || "",
      github: github || "",
      twitter: twitter || "",
      portfolio: portfolio || "",
    };

    // Convert each skill name to its corresponding ObjectId
    const skillIds = await Promise.all(
      skills.map(async (skillName) => {
        let skillDoc = await Skill.findOne({ name: skillName });
        if (!skillDoc) {
          skillDoc = await Skill.create({ name: skillName });
        }
        return skillDoc._id;
      })
    );

    // Update the profile data (email is not updated)
    const updatedProfile = await UserProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        name,
        title,
        location,
        phone,
        about,
        skills: skillIds,
        socialLinks,
      },
      { new: true, runValidators: true }
    );

    // Update experience if provided
    if (value.experience) {
      await Experience.deleteMany({ user: req.user._id });
      const expDocs = value.experience.map((exp) => ({
        ...exp,
        user: req.user._id,
      }));
      await Experience.insertMany(expDocs);
    }

    // Update education if provided
    if (value.education) {
      await Education.deleteMany({ user: req.user._id });
      const eduDocs = value.education.map((edu) => ({
        ...edu,
        user: req.user._id,
      }));
      await Education.insertMany(eduDocs);
    }

    // Re-fetch related documents
    const experiencesData = await Experience.find({ user: req.user._id });
    const educationData = await Education.find({ user: req.user._id });
    const certificates = await Certificate.find({ user: req.user._id });

    // Populate skills before sending response
    await updatedProfile.populate("skills");

    const profileData = updatedProfile.toObject();
    profileData.skills = updatedProfile.skills
      ? updatedProfile.skills.map((skill) => skill.name)
      : [];
    profileData.experience = experiencesData;
    profileData.education = educationData;
    profileData.certificates = certificates;
    profileData.email = req.user.email;

    res.json(profileData);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------
// PHOTO UPLOAD
// ----------------------------------
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = "uploads/photos";
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `photo-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for photo
});

export const uploadPhoto = [
  photoUpload.single("profilePhoto"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const profile = await UserProfile.findOne({ user: req.user._id });
      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }
      profile.profileImage = `/uploads/photos/${req.file.filename}`;
      await profile.save();
      res.json({ profileImage: profile.profileImage });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
];

// ----------------------------------
// RESUME UPLOAD (5MB limit + custom error handling)
// ----------------------------------
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = "uploads/resumes";
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `resume-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for resume
});

export const uploadResume = [
  // Custom middleware to handle Multer errors
  (req, res, next) => {
    resumeUpload.single("resume")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File size exceeds the maximum limit of 5MB." });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  // Actual controller logic
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const profile = await UserProfile.findOne({ user: req.user._id });
      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }
      profile.resume = `/uploads/resumes/${req.file.filename}`;
      profile.resumeName = req.file.originalname;
      await profile.save();

      res.json({ resume: profile.resume, resumeName: profile.resumeName });
    } catch (error) {
      console.error("Error uploading resume:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
];

export const removeResume = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "User profile not found" });
    }
    profile.resume = null;
    profile.resumeName = null;
    await profile.save();
    res.json({ resume: null, resumeName: null });
  } catch (error) {
    console.error("Error removing resume:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------
// CERTIFICATE UPLOAD (5MB limit)
// ----------------------------------
const certificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = "uploads/certificates";
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `certificate-${Date.now()}${path.extname(file.originalname)}`);
  },
});

export const certificateUpload = multer({
  storage: certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadCertificate = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Certificate title is required" });
  }
  try {
    const newCert = new Certificate({
      user: req.user._id,
      title,
      fileUrl: `/uploads/certificates/${req.file.filename}`,
    });
    await newCert.save();
    res.status(201).json({ certificate: newCert });
  } catch (error) {
    console.error("Error uploading certificate:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const cert = await Certificate.findOne({
      _id: certificateId,
      user: req.user._id,
    });
    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    await Certificate.deleteOne({ _id: certificateId });
    res.json({ message: "Certificate removed", certificate: cert });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------
// VIDEO UPLOAD (10MB limit)
// ----------------------------------
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = "uploads/video";
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `video-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadVideoIntro = [
  videoUpload.single("videoIntro"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No video uploaded" });
    }
    try {
      const profile = await UserProfile.findOne({ user: req.user._id });
      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }
      profile.videoIntroduction = `/uploads/video/${req.file.filename}`;
      await profile.save();
      res.json({ videoIntroduction: profile.videoIntroduction });
    } catch (error) {
      console.error("Error uploading video:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
];

export const deleteVideoIntro = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "User profile not found" });
    }
    profile.videoIntroduction = "";
    await profile.save();
    res.json({ message: "Video introduction removed" });
  } catch (error) {
    console.error("Error deleting video:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------
// ANALYTICS
// ----------------------------------
export const getAnalytics = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "User profile not found" });
    }
    const analyticsData = {
      profileViews: profile.profileViews || 0,
      interactions: profile.interactions || 0,
      jobMatchRank: profile.jobMatchRank || 0,
      viewsOverTime: profile.viewsOverTime || [],
    };
    res.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserDashboardOverview = async (req, res) => {
  try {
    // 1. Fetch total jobs posted across all companies (if needed)
    const totalJobPostings = await Job.countDocuments(); // Global job count

    // 2. Fetch total companies
    const totalCompanies = await Company.countDocuments(); // Global company count

    // 3. Calculate the success rate (applications per job)
    const totalApplications = await Application.countDocuments(); // Total applications
    const successRate = totalJobPostings
      ? Math.round((totalApplications / totalJobPostings) * 100)
      : 0;

    return res.json({
      totalJobPostings,
      totalCompanies,
      successRate,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
