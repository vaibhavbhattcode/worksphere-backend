// controllers/applicationController.js
import Application from "../models/Application.js";
import UserProfile from "../models/UserProfile.js";
import Job from "../models/Job.js";
import CompanyProfile from "../models/CompanyProfile.js";

export const submitApplication = async (req, res) => {
  try {
    const { jobId, coverLetter } = req.body;
    if (!jobId) {
      return res.status(400).json({ message: "Job ID is required." });
    }
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not logged in" });
    }
    const userId = req.user._id;
    const profile = await UserProfile.findOne({ user: userId });
    const resume = profile?.resume || "";
    const application = new Application({ jobId, userId, coverLetter, resume });
    await application.save();
    return res
      .status(201)
      .json({ message: "Application submitted successfully", application });
  } catch (err) {
    console.error("Error submitting application:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getApplicationsForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const applications = await Application.find({ jobId }).populate(
      "userId",
      "email name"
    );
    return res.status(200).json(applications);
  } catch (err) {
    console.error("Error fetching applications:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getUserApplication = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ message: "No application found" });
    }
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not logged in" });
    }
    const userId = req.user._id;
    const application = await Application.findOne({ jobId, userId });
    if (!application) {
      return res.status(404).json({ message: "No application found" });
    }
    return res.status(200).json(application);
  } catch (err) {
    console.error("Error fetching user application:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllUserApplications = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const applications = await Application.find({ userId: req.user._id });
    return res.status(200).json(applications);
  } catch (err) {
    console.error("Error fetching all user applications:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAppliedJobs = async (req, res) => {
  try {
    const userId = req.user._id;
    const applications = await Application.find({ userId });
    const jobs = await Promise.all(
      applications.map(async (app) => {
        const job = await Job.findById(app.jobId);
        if (!job) return null;
        const companyProfile = await CompanyProfile.findOne({
          company: job.companyId,
        });
        return {
          ...job.toObject(),
          companyName: companyProfile?.companyName || "Unknown Company",
          companyLogo:
            companyProfile &&
            companyProfile.logo &&
            companyProfile.logo.trim() !== ""
              ? companyProfile.logo
              : "/demo.png",
        };
      })
    );
    const filtered = jobs.filter((j) => j !== null);
    return res.status(200).json({ jobs: filtered });
  } catch (error) {
    console.error("Error fetching applied jobs:", error);
    return res
      .status(500)
      .json({ message: "Error fetching applied jobs", error: error.message });
  }
};
