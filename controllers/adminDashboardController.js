import User from "../models/User.js";
import Job from "../models/Job.js";
import Company from "../models/Company.js";
import Application from "../models/Application.js"; // Assuming Application model exists
import os from "os";

const adminDashboardController = {
  // Recent activities: recent user registrations, job postings, company signups
  getRecentActivities: async (req, res) => {
    try {
      const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("email createdAt role");

      const recentJobs = await Job.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title companyId createdAt");

      const recentCompanies = await Company.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("companyName createdAt");

      res.json({
        recentUsers,
        recentJobs,
        recentCompanies,
      });
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Error fetching recent activities" });
    }
  },

  // User engagement metrics: active users count (last 7 days), total applications submitted
  getUserEngagementMetrics: async (req, res) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeUsersCount = await User.countDocuments({
        lastLogin: { $gte: sevenDaysAgo },
      });

      const totalApplications = await Application.countDocuments();

      res.json({
        activeUsersCount,
        totalApplications,
      });
    } catch (error) {
      console.error("Error fetching user engagement metrics:", error);
      res.status(500).json({ message: "Error fetching user engagement metrics" });
    }
  },

  // Job application statistics: applications per job, average time to fill positions
  getJobApplicationStats: async (req, res) => {
    try {
      // Applications per job
      const applicationsPerJob = await Application.aggregate([
        {
          $group: {
            _id: "$jobId",
            applicationCount: { $sum: 1 },
          },
        },
        { $sort: { applicationCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "jobs",
            localField: "_id",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: "$job" },
        {
          $project: {
            jobTitle: "$job.title",
            applicationCount: 1,
          },
        },
      ]);

      // Average time to fill positions (from job posting to filled date)
      // Assuming Job model has 'filledAt' date field
      const filledJobs = await Job.aggregate([
        {
          $match: { filledAt: { $exists: true, $ne: null } },
        },
        {
          $project: {
            durationDays: {
              $divide: [
                { $subtract: ["$filledAt", "$createdAt"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgDurationDays: { $avg: "$durationDays" },
          },
        },
      ]);

      const avgTimeToFill = filledJobs.length > 0 ? filledJobs[0].avgDurationDays : null;

      res.json({
        applicationsPerJob,
        avgTimeToFill,
      });
    } catch (error) {
      console.error("Error fetching job application stats:", error);
      res.status(500).json({ message: "Error fetching job application stats" });
    }
  },

  // System health metrics: server uptime, memory usage, CPU load
  getSystemHealthMetrics: async (req, res) => {
    try {
      const uptimeSeconds = process.uptime();
      const memoryUsage = process.memoryUsage();
      const loadAverage = os.loadavg();

      res.json({
        uptimeSeconds,
        memoryUsage,
        loadAverage,
      });
    } catch (error) {
      console.error("Error fetching system health metrics:", error);
      res.status(500).json({ message: "Error fetching system health metrics" });
    }
  },
};

export default adminDashboardController;
