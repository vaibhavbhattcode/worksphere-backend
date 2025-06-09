import Job from "../models/Job.js";
import Applicant from "../models/Application.js";
import CompanyProfile from "../models/CompanyProfile.js";

export const getDashboardOverview = async (req, res) => {
  try {
    // Fetch the company profile for the logged-in company
    const companyProfile = await CompanyProfile.findOne({
      company: req.user._id,
    });
    // Merge the profile data with the user data from req.user
    const companyData = {
      ...req.user.toObject(),
      ...(companyProfile ? companyProfile.toObject() : {}),
    };

    // Ensure a valid companyName exists; if not, fallback to the email prefix
    if (!companyData.companyName || !companyData.companyName.trim()) {
      companyData.companyName = req.user.email
        ? req.user.email.split("@")[0]
        : "Your Company Name";
    }

    // Calculate total job postings for this company
    const totalJobPostings = await Job.countDocuments({
      companyId: req.user._id,
    });

    // Get all jobs posted by the company
    const jobs = await Job.find({ companyId: req.user._id });
    const jobIds = jobs.map((job) => job._id);

    // Aggregate total applications across all jobs
    let totalApplications = 0;
    for (const job of jobs) {
      const applicationsCount = await Applicant.countDocuments({
        jobId: job._id,
      });
      totalApplications += applicationsCount;
    }

    // Count interviews scheduled (assuming 'interviewDate' is set)
    const interviewsScheduled = await Applicant.countDocuments({
      jobId: { $in: jobIds },
      interviewDate: { $gte: new Date() },
    });

    // Get upcoming interviews (limit to 5)
    const upcomingInterviewsData = await Applicant.find({
      jobId: { $in: jobIds },
      interviewDate: { $gte: new Date() },
    })
      .limit(5)
      .populate("jobId", "jobTitle")
      .populate("userId", "email");

    const upcomingInterviews = upcomingInterviewsData.map((applicant) => ({
      candidateEmail: applicant.userId?.email || "Candidate",
      position: applicant.jobId?.jobTitle || "Position",
      date: applicant.interviewDate
        ? applicant.interviewDate.toISOString().split("T")[0]
        : "N/A",
    }));

    // Dynamic notifications for new applications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentApplications = await Applicant.find({
      jobId: { $in: jobIds },
      createdAt: { $gte: sevenDaysAgo },
    })
      .populate("jobId", "jobTitle")
      .populate("userId", "email")
      .limit(10);

    const notifications = recentApplications.map((app) => {
      const timeAgo = Math.floor(
        (new Date() - new Date(app.createdAt)) / (1000 * 60 * 60)
      );
      const timeText =
        timeAgo < 1
          ? "just now"
          : `${timeAgo} hour${timeAgo > 1 ? "s" : ""} ago`;
      return `New application from ${app.userId?.email || "a candidate"} for ${
        app.jobId?.jobTitle || "a position"
      } (${timeText})`;
    });

    // Dynamic application trends based on interval query parameter
    const interval = req.query.interval || "months"; // Default to months
    let startDate, groupBy, formatName;

    if (interval === "years") {
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 5); // Last 5 years
      groupBy = {
        year: { $year: "$createdAt" },
      };
      formatName = (date) => date.getFullYear().toString();
    } else if (interval === "hours") {
      startDate = new Date();
      startDate.setHours(startDate.getHours() - 24); // Last 24 hours
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        hour: { $hour: "$createdAt" },
      };
      formatName = (date) => `${date.getHours()}:00`;
    } else {
      // Default: months
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6); // Last 6 months
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
      formatName = (date) => {
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return monthNames[date.getMonth()];
      };
    }

    const applicationTrends = await Applicant.aggregate([
      {
        $match: {
          jobId: { $in: jobIds },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: groupBy,
          applications: { $sum: 1 },
        },
      },
      {
        $sort:
          interval === "hours"
            ? { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 }
            : { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Format application trends for the frontend
    const formattedTrends = [];
    const today = new Date();

    if (interval === "years") {
      for (let i = 4; i >= 0; i--) {
        const year = today.getFullYear() - i;
        const trend = applicationTrends.find((t) => t._id.year === year);
        formattedTrends.push({
          name: year.toString(),
          applications: trend ? trend.applications : 0,
        });
      }
    } else if (interval === "hours") {
      for (let i = 23; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 60 * 60 * 1000);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        const trend = applicationTrends.find(
          (t) =>
            t._id.year === year &&
            t._id.month === month &&
            t._id.day === day &&
            t._id.hour === hour
        );
        formattedTrends.push({
          name: `${hour}:00`,
          applications: trend ? trend.applications : 0,
        });
      }
    } else {
      // Months
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const trend = applicationTrends.find(
          (t) => t._id.year === year && t._id.month === month
        );
        formattedTrends.push({
          name: monthNames[month - 1],
          applications: trend ? trend.applications : 0,
        });
      }
    }

    // Build the dashboard data object
    const dashboardData = {
      company: {
        ...companyData,
        email: req.user.email, // ensure the email is always included
      },
      metrics: {
        totalJobPostings,
        totalApplications,
        interviewsScheduled,
        notifications,
        upcomingInterviews,
        applicationTrends: formattedTrends,
      },
      // Mark profile incomplete if companyName is still the fallback value
      incompleteProfile:
        !companyProfile ||
        !companyProfile.companyName ||
        !companyProfile.companyName.trim(),
      incompleteProfileMessage:
        !companyProfile ||
        !companyProfile.companyName ||
        !companyProfile.companyName.trim()
          ? "Your profile is incomplete. Please complete your profile for a better experience."
          : "",
    };

    return res.json(dashboardData);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
