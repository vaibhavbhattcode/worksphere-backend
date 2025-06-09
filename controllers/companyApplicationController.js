// controllers/companyApplicationController.js
import Applicant from "../models/Application.js";
import Job from "../models/Job.js"; // import Job to fetch company jobs
import UserProfile from "../models/UserProfile.js"; // <-- Import the UserProfile model
const getBackendUrl = () => process.env.BACKEND_URL || "http://localhost:5000";

// Existing function for a single job's applications (if needed)
export const getJobApplications = async (req, res) => {
  const { jobId } = req.params;
  try {
    let applications = await Applicant.find({ jobId })
      .populate("userId", "email name resume")
      .lean();

    // Filter out applications with missing userId or userId._id
    const filteredApps = applications.filter(
      (app) => app.userId && app.userId._id
    );

    // Use Promise.allSettled for error-tolerant profile merging
    const populatedAppsResults = await Promise.allSettled(
      filteredApps.map(async (app) => {
        let mergedUser = { ...app.userId };
        if (app.userId && app.userId._id) {
          try {
            const profile = await UserProfile.findOne({
              user: app.userId._id,
            }).lean();
            if (profile) {
              mergedUser = { ...mergedUser, ...profile };
            }
          } catch (e) {}
        }
        let resumeUrl = mergedUser.resume || app.resume;
        if (resumeUrl && resumeUrl.startsWith("/")) {
          resumeUrl = `${getBackendUrl()}${resumeUrl}`;
        }
        mergedUser.resume = resumeUrl;
        return { ...app, userId: mergedUser };
      })
    );
    const populatedApps = populatedAppsResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    return res.status(200).json(populatedApps);
  } catch (err) {
    console.error("Error fetching applications:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
// NEW: Get all applications for all jobs posted by the company
export const getAllApplicationsForCompany = async (req, res) => {
  try {
    // Find all jobs posted by the logged-in company
    const jobs = await Job.find({ companyId: req.user._id });
    const jobIds = jobs.map((job) => job._id);

    // Find all applications where jobId is in the company's job IDs
    const applications = await Applicant.find({ jobId: { $in: jobIds } })
      .populate("userId", "name email resume coverLetter profileDetails phone")
      .populate(
        "jobId",
        "jobTitle" // Get job title or other fields from the Job model
      );

    return res.status(200).json(applications);
  } catch (err) {
    console.error("Error fetching all applications:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateApplicationStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  // Validate status: allow only "hired" or "rejected"
  const allowedStatuses = ["hired", "rejected"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const application = await Applicant.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    application.status = status;
    await application.save();
    return res
      .status(200)
      .json({ message: `Application ${status} successfully`, application });
  } catch (err) {
    console.error("Error updating application status:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
