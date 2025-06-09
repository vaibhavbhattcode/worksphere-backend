import User from "../models/User.js";
import Company from "../models/Company.js";
import Job from "../models/Job.js";
import logAdminAction from "../utils/logAdminAction.js";
import sendEmail from "../utils/sendEmail.js";
import allIndustries from "../config/industries.js";

const adminController = {
  // Fetch dashboard stats
  getStats: async (req, res) => {
    try {
      const userCount = await User.countDocuments();
      const companyCount = await Company.countDocuments();
      const jobCount = await Job.countDocuments();

      res.json({
        users: userCount,
        companies: companyCount,
        jobs: jobCount,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching stats", error });
    }
  },

  // User Management
  getAllUsers: async (req, res) => {
    try {
      const { search, status, sortBy, sortOrder, page = 1, limit } = req.query;

      const query = {};

      if (search) {
        const regex = new RegExp(search, "i");
        query.$or = [
          { email: regex },
          { role: regex },
          { isAdmin: search.toLowerCase() === "admin" ? true : false },
        ];
      }

      // Always filter role to jobSeeker to exclude admins
      query.role = "jobSeeker";

      if (status) {
        if (status.toLowerCase() === "active") {
          query.isActive = true;
        } else if (status.toLowerCase() === "deactivated") {
          query.isActive = false;
        }
      }

      const sortOptions = {};
      if (sortBy) {
        sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
      } else {
        sortOptions.createdAt = -1;
      }

      const pageNumber = parseInt(page, 10);
      const pageSize = parseInt(limit, 10);

      // If limit is 0 or less, fetch all users without pagination
      let usersQuery = User.find(query).sort(sortOptions);
      if (pageSize > 0) {
        usersQuery = usersQuery.skip((pageNumber - 1) * pageSize).limit(pageSize);
      }
      const users = await usersQuery;

      const totalUsers = await User.countDocuments(query);

      const UserProfile = (await import("../models/UserProfile.js")).default;
      const Skill = (await import("../models/Skill.js")).default;
      const Education = (await import("../models/Education.js")).default;
      const Experience = (await import("../models/Experience.js")).default;

      const profiles = await UserProfile.find({
        user: { $in: users.map((u) => u._id) },
      }).populate("skills");
      const educations = await Education.find({
        user: { $in: users.map((u) => u._id) },
      });
      const experiences = await Experience.find({
        user: { $in: users.map((u) => u._id) },
      });

      const profileMap = {};
      profiles.forEach((profile) => {
        profileMap[profile.user.toString()] = profile.toObject();
      });

      const educationMap = {};
      educations.forEach((edu) => {
        if (!educationMap[edu.user.toString()]) {
          educationMap[edu.user.toString()] = [];
        }
        educationMap[edu.user.toString()].push(edu);
      });

      const experienceMap = {};
      experiences.forEach((exp) => {
        if (!experienceMap[exp.user.toString()]) {
          experienceMap[exp.user.toString()] = [];
        }
        experienceMap[exp.user.toString()].push(exp);
      });

      const usersWithProfile = users.map((user) => {
        const userId = user._id.toString();
        const profile = profileMap[userId] || {};
        profile.education = educationMap[userId] || [];
        profile.experience = experienceMap[userId] || [];
        return {
          ...user.toObject(),
          profile,
        };
      });

      res.json({
        users: usersWithProfile,
        total: totalUsers,
        page: pageNumber,
        limit: pageSize,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching users", error });
    }
  },

  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = await User.findByIdAndUpdate(id, updates, { new: true });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Error updating user", error });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user._id;

      const user = await User.findByIdAndDelete(id);

      await logAdminAction("Delete User", adminId, { userId: id });

      if (user) {
        await sendEmail(
          user.email,
          "Account Deletion Notification",
          `Dear ${user.name}, your account has been deleted by the admin.`,
          `<p>Dear ${user.name},</p><p>Your account has been deleted by the admin.</p>`
        );
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting user", error });
    }
  },

  toggleUserActive: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user._id;

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const previousStatus = user.isActive;
      user.isActive = !user.isActive;
      await user.save();

      await logAdminAction(
        user.isActive ? "Activate User" : "Deactivate User",
        adminId,
        { userId: id }
      );

      if (previousStatus !== user.isActive) {
        sendEmail(
          user.email,
          user.isActive ? "Account Activated" : "Account Deactivated",
          `Dear ${
            user.name || user.email.split("@")[0]
          }, your account has been ${
            user.isActive ? "activated" : "deactivated"
          } by the admin.`,
          `<p>Dear ${
            user.name || user.email.split("@")[0]
          },</p><p>Your account has been ${
            user.isActive ? "activated" : "deactivated"
          } by the admin.</p>`
        ).catch((emailError) => {
          console.error("Failed to send activation email:", emailError);
        });
      }

      res.json({
        message: `User ${
          user.isActive ? "activated" : "deactivated"
        } successfully`,
        isActive: user.isActive,
      });
    } catch (error) {
      res.status(500).json({ message: "Error toggling user status", error });
    }
  },

  getUserGrowth: async (req, res) => {
    try {
      const { interval = "monthly", date, month, year } = req.query;
      let match = {};
      let groupBy;
      let labels = [];
      if (interval === "hourly") {
        const selectedDate = date ? new Date(date) : new Date();
        const start = new Date(selectedDate.setHours(0, 0, 0, 0));
        const end = new Date(selectedDate.setHours(23, 59, 59, 999));
        match = { createdAt: { $gte: start, $lte: end } };
        groupBy = { $hour: "$createdAt" };
        labels = Array.from({ length: 24 }, (_, i) => i);
      } else if (interval === "yearly") {
        const y = parseInt(year) || new Date().getFullYear();
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);
        match = { createdAt: { $gte: start, $lt: end } };
        groupBy = { $month: "$createdAt" };
        labels = Array.from({ length: 12 }, (_, i) => i + 1);
      } else {
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        match = { createdAt: { $gte: start, $lt: end } };
        groupBy = { $dayOfMonth: "$createdAt" };
        const daysInMonth = new Date(y, m, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      }
      const growthData = await User.aggregate([
        { $match: match },
        { $group: { _id: groupBy, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      const dataMap = Object.fromEntries(
        growthData.map((d) => [d._id, d.count])
      );
      const formattedData = labels.map((label) => ({
        interval: label,
        count: dataMap[label] || 0,
      }));
      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching user growth data:", error);
      res
        .status(500)
        .json({ message: "Error fetching user growth data", error });
    }
  },

  // Company Management
  getAllCompanies: async (req, res) => {
    try {
      const { page = 1, limit } = req.query;
      const CompanyProfile = (await import("../models/CompanyProfile.js"))
        .default;

      const pageNumber = parseInt(page, 10);
      const pageSize = parseInt(limit, 10);

      // Aggregate with pagination
      let companiesAggregation = Company.aggregate([
        {
          $lookup: {
            from: "companyprofiles",
            localField: "_id",
            foreignField: "company",
            as: "companyProfile",
          },
        },
        {
          $unwind: {
            path: "$companyProfile",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            companyName: { $ifNull: ["$companyProfile.companyName", ""] },
          },
        },
        {
          $project: {
            email: 1,
            isActive: 1,
            companyName: 1,
          },
        },
      ]);

      if (pageSize > 0) {
        companiesAggregation = companiesAggregation
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize);
      }

      const companies = await companiesAggregation.exec();

      const totalCompanies = await Company.countDocuments();

      res.json({
        companies,
        total: totalCompanies,
        page: pageNumber,
        limit: pageSize,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching companies", error });
    }
  },
  updateCompany: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const company = await Company.findByIdAndUpdate(id, updates, {
        new: true,
      });
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Error updating company", error });
    }
  },
  deleteCompany: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user._id;

      const company = await Company.findByIdAndDelete(id);

      await logAdminAction("Delete Company", adminId, { companyId: id });

      if (company) {
        await sendEmail(
          company.email,
          "Company Account Deletion Notification",
          `Dear ${company.name}, your company account has been deleted by the admin.`,
          `<p>Dear ${company.name},</p><p>Your company account has been deleted by the admin.</p>`
        );
      }

      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting company", error });
    }
  },

  toggleCompanyActive: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user._id;

      const company = await Company.findById(id);
      if (!company)
        return res.status(404).json({ message: "Company not found" });

      const previousStatus = company.isActive;
      company.isActive = !company.isActive;
      await company.save();

      await logAdminAction(
        company.isActive ? "Activate Company" : "Deactivate Company",
        adminId,
        { companyId: id }
      );

      if (previousStatus !== company.isActive) {
        sendEmail(
          company.email,
          company.isActive
            ? "Company Account Activated"
            : "Company Account Deactivated",
          `Dear ${
            company.name || company.email.split("@")[0]
          }, your company account has been ${
            company.isActive ? "activated" : "deactivated"
          } by the admin.`,
          `<p>Dear ${
            company.name || company.email.split("@")[0]
          },</p><p>Your company account has been ${
            company.isActive ? "activated" : "deactivated"
          } by the admin.</p>`
        ).catch((emailError) => {
          console.error("Failed to send activation email:", emailError);
        });
      }

      res.json({
        message: `Company ${
          company.isActive ? "activated" : "deactivated"
        } successfully`,
        isActive: company.isActive,
      });
    } catch (error) {
      console.error("Error toggling company status:", error);
      res.status(500).json({ message: "Error toggling company status", error });
    }
  },

  // Job Management
  getAllJobs: async (req, res) => {
    try {
      const jobs = await Job.find();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching jobs", error });
    }
  },
  updateJob: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const job = await Job.findByIdAndUpdate(id, updates, { new: true });
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Error updating job", error });
    }
  },
  deleteJob: async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user._id;

      const job = await Job.findByIdAndDelete(id);

      await logAdminAction("Delete Job", adminId, { jobId: id });

      if (job) {
        const company = await Company.findById(job.companyId);
        if (company) {
          await sendEmail(
            company.email,
            "Job Deletion Notification",
            `Dear ${company.name}, your job posting titled "${job.title}" has been deleted by the admin.`,
            `<p>Dear ${company.name},</p><p>Your job posting titled "${job.title}" has been deleted by the admin.</p>`
          );
        }
      }

      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting job", error });
    }
  },

  // Stats
  getJobStats: async (req, res) => {
    try {
      const jobStats = await Job.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      res.json(jobStats);
    } catch (error) {
      console.error("Error fetching job stats:", error);
      res.status(500).json({ message: "Error fetching job stats", error });
    }
  },

  getCompanyStats: async (req, res) => {
    try {
      // Dynamically import CompanyProfile model
      const CompanyProfile = (await import("../models/CompanyProfile.js"))
        .default;

      // Fetch all company profiles
      const companyProfiles = await CompanyProfile.find().lean();

      // Normalize allIndustries for case-insensitive matching
      const industryMap = {};
      allIndustries.forEach((industry) => {
        industryMap[industry.toLowerCase().trim()] = industry;
      });

      // Count companies per industry and track unmatched industries
      const industryCountMap = {};
      const unmatchedIndustries = {};
      allIndustries.forEach((industry) => {
        industryCountMap[industry] = 0;
      });

      companyProfiles.forEach((profile) => {
        let companyIndustry = profile.industry;
        if (companyIndustry) {
          // Trim whitespace and convert to lowercase for comparison
          companyIndustry = companyIndustry.trim();
          const companyIndustryLower = companyIndustry.toLowerCase();
          // Find the matching industry in allIndustries (case-insensitive)
          const matchedIndustry = Object.keys(industryMap).find(
            (key) => key === companyIndustryLower
          );
          if (matchedIndustry) {
            const normalizedIndustry = industryMap[matchedIndustry];
            industryCountMap[normalizedIndustry] =
              (industryCountMap[normalizedIndustry] || 0) + 1;
          } else {
            // Track unmatched industries
            unmatchedIndustries[companyIndustry] =
              (unmatchedIndustries[companyIndustry] || 0) + 1;
            console.log(
              `Unmatched industry: "${companyIndustry}" (lowercase: "${companyIndustryLower}") for company profile ${profile.companyName}`
            );
          }
        } else {
          console.log(
            `Missing industry for company profile ${profile.companyName}`
          );
          unmatchedIndustries["Missing"] =
            (unmatchedIndustries["Missing"] || 0) + 1;
        }
      });

      // Convert to array format for the response
      const statsWithAllIndustries = allIndustries.map((industry) => ({
        industry,
        count: industryCountMap[industry] || 0,
      }));

      // Aggregate jobs by companyId to get job counts with company profile details
      const topCompaniesWithJobCount = await Job.aggregate([
        {
          $group: {
            _id: "$companyId",
            jobCount: { $sum: 1 },
          },
        },
        { $sort: { jobCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "companyprofiles",
            localField: "_id",
            foreignField: "company",
            as: "companyProfile",
          },
        },
        { $unwind: "$companyProfile" },
        {
          $project: {
            _id: 0,
            name: "$companyProfile.companyName",
            jobCount: 1,
          },
        },
      ]);

      res.json({
        industryStats: statsWithAllIndustries,
        topCompanies: topCompaniesWithJobCount,
        unmatchedIndustries: Object.entries(unmatchedIndustries).map(
          ([industry, count]) => ({
            industry,
            count,
          })
        ),
      });
    } catch (error) {
      console.error("Error fetching company stats:", error);
      res.status(500).json({ message: "Error fetching company stats", error });
    }
  },

  getJobTrends: async (req, res) => {
    try {
      const { interval = "monthly", date, month, year } = req.query;
      let match = {};
      let groupBy;
      let labels = [];
      if (interval === "hourly") {
        const selectedDate = date ? new Date(date) : new Date();
        const start = new Date(selectedDate.setHours(0, 0, 0, 0));
        const end = new Date(selectedDate.setHours(23, 59, 59, 999));
        match = { createdAt: { $gte: start, $lte: end } };
        groupBy = { $hour: "$createdAt" };
        labels = Array.from({ length: 24 }, (_, i) => i);
      } else if (interval === "yearly") {
        const y = parseInt(year) || new Date().getFullYear();
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);
        match = { createdAt: { $gte: start, $lt: end } };
        groupBy = { $month: "$createdAt" };
        labels = Array.from({ length: 12 }, (_, i) => i + 1);
      } else {
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        match = { createdAt: { $gte: start, $lt: end } };
        groupBy = { $dayOfMonth: "$createdAt" };
        const daysInMonth = new Date(y, m, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      }
      const jobTrends = await Job.aggregate([
        { $match: match },
        { $group: { _id: groupBy, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      const dataMap = Object.fromEntries(
        jobTrends.map((d) => [d._id, d.count])
      );
      const formattedTrends = labels.map((label) => ({
        interval: label,
        count: dataMap[label] || 0,
      }));
      res.json(formattedTrends);
    } catch (error) {
      console.error("Error fetching job trends:", error);
      res.status(500).json({ message: "Error fetching job trends", error });
    }
  },
  // Get full company details including profile, jobs, interviews, hiring data
  getCompanyDetails: async (req, res) => {
    try {
      const { id } = req.params;

      const CompanyProfile = (await import("../models/CompanyProfile.js"))
        .default;
      const Job = (await import("../models/Job.js")).default;
      const Interview = (await import("../models/Interview.js")).default;

      // Fetch company profile
      const companyProfile = await CompanyProfile.findOne({
        company: id,
      }).lean();

      // Fetch posted jobs
      const jobs = await Job.find({ companyId: id }).lean();

      // Fetch interviews related to company jobs
      const jobIds = jobs.map((job) => job._id);
      const interviews = await Interview.find({
        jobId: { $in: jobIds },
      }).lean();

      // Hiring data: count of active jobs and interviews
      const activeJobsCount = jobs.filter(
        (job) => job.status === "active"
      ).length;
      const totalInterviews = interviews.length;

      res.json({
        companyProfile,
        jobs,
        interviews,
        hiringData: {
          activeJobsCount,
          totalInterviews,
        },
      });
    } catch (error) {
      console.error("Error fetching company details:", error);
      res
        .status(500)
        .json({ message: "Error fetching company details", error });
    }
  },
  bulkToggleUsersActive: async (req, res) => {
    try {
      const { ids, isActive } = req.body;
      const adminId = req.user._id;

      if (!Array.isArray(ids) || typeof isActive !== "boolean") {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const users = await User.find({ _id: { $in: ids } });

      await Promise.all(
        users.map(async (user) => {
          const previousStatus = user.isActive;
          user.isActive = isActive;
          await user.save();

          await logAdminAction(
            isActive ? "Activate User" : "Deactivate User",
            adminId,
            { userId: user._id }
          );

          if (previousStatus !== isActive) {
            sendEmail(
              user.email,
              isActive ? "Account Activated" : "Account Deactivated",
              `Dear ${
                user.name || user.email.split("@")[0]
              }, your account has been ${
                isActive ? "activated" : "deactivated"
              } by the admin.`,
              `<p>Dear ${
                user.name || user.email.split("@")[0]
              },</p><p>Your account has been ${
                isActive ? "activated" : "deactivated"
              } by the admin.</p>`
            ).catch((emailError) => {
              console.error("Failed to send activation email:", emailError);
            });
          }
        })
      );

      res.json({
        message: `Users ${isActive ? "activated" : "deactivated"} successfully`,
        isActive,
      });
    } catch (error) {
      res.status(500).json({ message: "Error toggling users status", error });
    }
  },

  bulkToggleCompaniesActive: async (req, res) => {
    try {
      const { ids, isActive } = req.body;
      const adminId = req.user._id;

      if (!Array.isArray(ids) || typeof isActive !== "boolean") {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const companies = await Company.find({ _id: { $in: ids } });

      await Promise.all(
        companies.map(async (company) => {
          const previousStatus = company.isActive;
          company.isActive = isActive;
          await company.save();

          await logAdminAction(
            isActive ? "Activate Company" : "Deactivate Company",
            adminId,
            { companyId: company._id }
          );

          if (previousStatus !== isActive) {
            sendEmail(
              company.email,
              isActive
                ? "Company Account Activated"
                : "Company Account Deactivated",
              `Dear ${
                company.name || company.email.split("@")[0]
              }, your company account has been ${
                isActive ? "activated" : "deactivated"
              } by the admin.`,
              `<p>Dear ${
                company.name || company.email.split("@")[0]
              },</p><p>Your company account has been ${
                isActive ? "activated" : "deactivated"
              } by the admin.</p>`
            ).catch((emailError) => {
              console.error("Failed to send activation email:", emailError);
            });
          }
        })
      );

      res.json({
        message: `Companies ${
          isActive ? "activated" : "deactivated"
        } successfully`,
        isActive,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error toggling companies status", error });
    }
  },
};

export default adminController;
