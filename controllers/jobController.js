// backend/controllers/jobController.js

import Joi from "joi";
import Job from "../models/Job.js";
import Applicant from "../models/Application.js";
import Notification from "../models/Notification.js";
import UserProfile from "../models/UserProfile.js";
import User from "../models/User.js";
import Search from "../models/Search.js";
import CompanyProfile from "../models/CompanyProfile.js";

// Schemas for creating/updating a Job
const jobSchema = Joi.object({
  jobTitle: Joi.string().min(5).max(100).required(),
  description: Joi.string().min(20).required(),
  jobType: Joi.string()
    .valid("Full-time", "Part-time", "Contract", "Internship", "Temporary")
    .required(),
  location: Joi.string().required(),
  industry: Joi.string().allow("").optional(),
  remoteOption: Joi.boolean().default(false),
  skills: Joi.string().allow("").optional(),
  experienceLevel: Joi.string()
    .valid("Entry-level", "Mid-level", "Senior", "Executive")
    .optional(),
  applicationDeadline: Joi.date().greater("now").optional(),
  salaryRange: Joi.string().allow("").optional(),
  minSalary: Joi.number().optional(),
  maxSalary: Joi.number().optional(),
  currency: Joi.string().optional(),
  benefits: Joi.string().allow("").optional(),
  responsibilities: Joi.string().allow("").optional(),
  qualifications: Joi.string().allow("").optional(),
}).unknown(true);

const updateJobSchema = jobSchema;

//////////////////////////////
// Create a new Job
//////////////////////////////
export const createJob = async (req, res) => {
  const { error, value } = jobSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const {
    jobTitle,
    description,
    jobType,
    location,
    industry,
    remoteOption,
    skills,
    experienceLevel,
    applicationDeadline,
    salaryRange,
    minSalary,
    maxSalary,
    currency,
    benefits,
    responsibilities,
    qualifications,
  } = value;

  const contactEmail = req.user.email;
  const companyId = req.user._id;

  const skillsArray = skills
    ? skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  let salary;
  if (minSalary != null && maxSalary != null && currency) {
    salary = {
      min: parseFloat(minSalary),
      max: parseFloat(maxSalary),
      currency: currency.toUpperCase(),
    };
  } else if (salaryRange) {
    const parts = salaryRange
      .replace(/[$,]/g, "")
      .split("-")
      .map((p) => p.trim());
    if (parts.length === 2) {
      const min = parseFloat(parts[0]),
        max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        salary = { min, max, currency: "USD" };
      }
    }
  }

  try {
    const job = new Job({
      jobTitle,
      description,
      jobType,
      location,
      industry,
      remoteOption,
      skills: skillsArray,
      experienceLevel,
      applicationDeadline,
      salary,
      contactEmail,
      companyId,
      status: "Open",
      benefits: benefits
        ? benefits
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      responsibilities: responsibilities
        ? responsibilities
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      qualifications: qualifications
        ? qualifications
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });

    await job.save();

    // 🔔 Notify users with matching skills or job title
    const allProfiles = await UserProfile.find().populate("skills");
    const jobSkills = skillsArray.map((s) => s.toLowerCase());
    const jobTitleLower = jobTitle.toLowerCase();

    const notifications = [];

    for (const profile of allProfiles) {
      const userSkills = profile.skills.map((s) => s.name?.toLowerCase());
      const titleMatch = profile.title?.toLowerCase() === jobTitleLower;
      const skillsMatch = userSkills.some((skill) => jobSkills.includes(skill));

      if (titleMatch || skillsMatch) {
        notifications.push({
          user: profile.user,
          job: job._id,
          message: `📢 New job posted: ${job.jobTitle} in ${job.location}`,
        });
      }
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ message: "Job posted successfully", job });
  } catch (err) {
    console.error("Error posting job:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Get jobs posted by the company
//////////////////////////////
export const getPostedJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ companyId: req.user._id });
    const now = new Date();

    const jobsWithApplicationCount = await Promise.all(
      jobs.map(async (job) => {
        const count = await Applicant.countDocuments({ jobId: job._id });
        const expired =
          job.applicationDeadline && job.applicationDeadline < now;
        return {
          ...job.toObject(),
          applicationCount: count,
          status: expired ? "Closed" : job.status,
        };
      })
    );

    res.status(200).json(jobsWithApplicationCount);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Get job details by ID
//////////////////////////////
export const getJobDetails = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.params.id;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // If CompanyProfile model is missing, just return fallback:
    if (!CompanyProfile) {
      return res.status(200).json({
        ...job.toObject(),
        companyName: "Unknown Company",
        companyLogo: "/demo.png",
      });
    }

    // Otherwise, look up the CompanyProfile row for this job’s companyId
    const company = await CompanyProfile.findOne({
      company: job.companyId,
    }).select("companyName logo");

    res.status(200).json({
      ...job.toObject(),
      companyName: company?.companyName || "Unknown Company",
      companyLogo: company?.logo || "/demo.png",
    });
  } catch (error) {
    console.error("Error fetching job details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Update a job (by company)
//////////////////////////////
export const updateJob = async (req, res) => {
  const { error, value } = updateJobSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      companyId: req.user._id,
    });
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (value.minSalary != null || value.maxSalary != null || value.currency) {
      const min = parseFloat(value.minSalary);
      const max = parseFloat(value.maxSalary);
      if (!isNaN(min) && !isNaN(max) && value.currency) {
        job.salary = { min, max, currency: value.currency.toUpperCase() };
      }
      delete value.minSalary;
      delete value.maxSalary;
      delete value.currency;
    }

    ["benefits", "responsibilities", "qualifications"].forEach((key) => {
      if (typeof value[key] === "string") {
        job[key] = value[key]
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (Array.isArray(value[key])) {
        job[key] = value[key];
      }
    });

    Object.keys(value).forEach((key) => {
      if (!["benefits", "responsibilities", "qualifications"].includes(key)) {
        job[key] = value[key];
      }
    });

    await job.save();
    res.status(200).json({ message: "Job updated successfully", job });
  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Get applicants for a job (company-only)
//////////////////////////////
export const getJobApplicants = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      companyId: req.user._id,
    });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const applicants = await Applicant.find({
      jobId: req.params.jobId,
    }).populate("userId", "email");
    res.status(200).json(applicants);
  } catch (err) {
    console.error("Error fetching applicants:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Delete a job (company-only)
//////////////////////////////
export const deleteJob = async (req, res) => {
  try {
    if (!req.params.jobId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid Job ID format" });
    }
    const job = await Job.findOne({ _id: req.params.jobId });
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await Job.deleteOne({ _id: req.params.jobId });
    res.status(200).json({ message: "Job deleted successfully" });
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Get all jobs (public/admin)
//////////////////////////////
export const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find();
    const populated = await Promise.all(
      jobs.map(async (job) => {
        if (!CompanyProfile) {
          return {
            ...job.toObject(),
            companyName: "Unknown Company",
            companyLogo: "/demo.png",
          };
        }
        const comp = await CompanyProfile.findOne({
          company: job.companyId,
        }).select("companyName logo");
        return {
          ...job.toObject(),
          companyName: comp?.companyName || "Unknown Company",
          companyLogo: comp?.logo || "/demo.png",
        };
      })
    );
    res.status(200).json(populated);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ message: "Error fetching jobs" });
  }
};

//////////////////////////////
// Get filtered jobs via query parameters (public)
//////////////////////////////
export const getJobs = async (req, res) => {
  try {
    const {
      search,
      datePosted,
      experience,
      remote,
      jobType,
      industry,
      location,
    } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { jobTitle: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    if (datePosted && datePosted !== "any") {
      let timeLimit;
      if (datePosted === "24h") timeLimit = Date.now() - 24 * 60 * 60 * 1000;
      else if (datePosted === "week")
        timeLimit = Date.now() - 7 * 24 * 60 * 60 * 1000;
      else if (datePosted === "month")
        timeLimit = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (timeLimit) query.createdAt = { $gte: new Date(timeLimit) };
    }

    if (experience && experience !== "any") query.experienceLevel = experience;
    if (remote && remote !== "any") query.remoteOption = remote === "true";
    if (jobType && jobType !== "any") query.jobType = jobType;
    if (industry) query.industry = { $in: industry.split(",") };

    // — Do a single find(), then populate only companyProfile —
    const jobs = await Job.find(query).sort({ createdAt: -1 }).populate({
      path: "companyProfile", // ← only the virtual from Job → CompanyProfile
      select: "companyName logo",
    });

    // Flatten each job document so front end always sees companyName + companyLogo
    const flattened = jobs.map((jobDoc) => {
      const jobObj = jobDoc.toObject();

      // Try to read from CompanyProfile first. If it’s missing, use "Unknown Company".
      const profileName =
        jobObj.companyProfile && jobObj.companyProfile.companyName;
      const profileLogo = jobObj.companyProfile && jobObj.companyProfile.logo;

      return {
        ...jobObj,
        companyName: profileName || "Unknown Company",
        companyLogo: profileLogo || "/demo.png",
      };
    });

    return res.status(200).json(flattened);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({ message: "Error fetching jobs" });
  }
};

//////////////////////////////
// Update job status (company-only)
//////////////////////////////
export const updateJobStatus = async (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;
  if (!["Open", "Closed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  try {
    const job = await Job.findOne({ _id: jobId, companyId: req.user._id });
    if (!job) return res.status(404).json({ message: "Job not found" });
    job.status = status;
    await job.save();
    res.status(200).json({ message: `Status updated to ${status}`, job });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Get jobs by a specific Company ID (public)
//////////////////////////////
export const getJobsByCompanyId = async (req, res) => {
  try {
    const companyProfile = await CompanyProfile.findById(req.params.companyId);
    if (!companyProfile)
      return res.status(404).json({ message: "Company not found" });
    const jobs = await Job.find({
      companyId: companyProfile.company,
      status: "Open",
    });
    const populated = jobs.map((job) => ({
      ...job.toObject(),
      companyName: companyProfile.companyName || "Unknown Company",
      companyLogo: companyProfile.logo || "/demo.png",
    }));
    res.status(200).json(populated);
  } catch (error) {
    console.error("Error fetching company jobs:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// Get a single job’s details for a company (company-only)
//////////////////////////////
export const getCompanyJobDetails = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      companyId: req.user._id,
    });
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (!CompanyProfile) {
      return res.status(200).json({
        ...job.toObject(),
        companyName: "Unknown Company",
        companyLogo: "/demo.png",
      });
    }
    const company = await CompanyProfile.findOne({
      company: req.user._id,
    }).select("companyName logo");
    res.status(200).json({
      ...job.toObject(),
      companyName: company?.companyName || "Unknown Company",
      companyLogo: company?.logo || "/demo.png",
    });
  } catch (error) {
    console.error("Error fetching company job details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//////////////////////////////
// GetRecommendedAndAllJobs
//////////////////////////////
export const getRecommendedAndAllJobs = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const recommendedSet = new Set();

    // 1) If user is logged in, build their “keywords” from profile.skills + past searches
    if (userId) {
      const profile = await UserProfile.findOne({ user: userId }).populate(
        "skills"
      );
      const searches = await Search.find({ user: userId });

      const keywords = new Set();

      if (profile && Array.isArray(profile.skills)) {
        profile.skills.forEach((skill) => {
          if (skill.name) keywords.add(skill.name.toLowerCase());
        });
      }

      if (Array.isArray(searches)) {
        searches.forEach((s) => {
          if (typeof s.query === "string") {
            s.query
              .split(" ")
              .map((w) => w.trim().toLowerCase())
              .filter(Boolean)
              .forEach((word) => keywords.add(word));
          }
        });
      }

      const keywordArray = Array.from(keywords).filter(Boolean);

      if (keywordArray.length > 0) {
        const regexes = keywordArray.map((k) => new RegExp(k, "i"));
        const matchedJobs = await Job.find({
          status: "Open",
          applicationDeadline: { $gte: new Date() },
          $or: [{ jobTitle: { $in: regexes } }, { skills: { $in: regexes } }],
        }).select("_id");

        matchedJobs.forEach((doc) => {
          recommendedSet.add(doc._id.toString());
        });
      }
    }

    // 2) Fetch ALL open jobs, sorted by creation date descending.
    //    Populate only `companyProfile` virtual
    let allJobs = await Job.find({
      status: "Open",
      applicationDeadline: { $gte: new Date() },
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "companyProfile", // virtual defined in Job schema
        select: "companyName logo",
      });

    // 3) Map each job → plain object, add `isRecommended`, pick name/logo
    const jobsWithFlags = allJobs.map((jobDoc) => {
      const jobObj = jobDoc.toObject();
      const isRec = recommendedSet.has(jobObj._id.toString());

      // If companyProfile exists, use it. Otherwise: "Unknown Company"
      const profileName =
        jobObj.companyProfile && jobObj.companyProfile.companyName;
      const profileLogo = jobObj.companyProfile && jobObj.companyProfile.logo;

      return {
        ...jobObj,
        isRecommended: isRec,
        companyName: profileName || "Unknown Company",
        companyLogo: profileLogo || "/demo.png",
      };
    });

    // 4) Sort so that recommended jobs come first, then by createdAt desc
    jobsWithFlags.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 5) Return the final array of jobs
    return res.status(200).json(jobsWithFlags);
  } catch (err) {
    console.error("[jobController] Error in getRecommendedAndAllJobs:", err);
    return res
      .status(500)
      .json({ message: "Failed to load jobs. Please try again later." });
  }
};
