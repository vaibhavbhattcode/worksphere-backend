// controllers/jobCategoriesController.js
import Job from "../models/Job.js";

export const getJobCategories = async (req, res) => {
  try {
    const categories = await Job.aggregate([
      { $match: { status: "Open" } },
      {
        $group: {
          _id: "$industry",
          totalJobs: { $sum: 1 },
          jobs: { $push: { jobTitle: "$jobTitle", _id: "$_id" } }, // Include job IDs
        },
      },
      {
        $project: {
          industry: "$_id",
          totalJobs: 1,
          jobs: 1,
          _id: 0,
        },
      },
      { $sort: { totalJobs: -1 } },
      { $limit: 3 },
    ]);

    const formattedCategories = categories.map((cat, index) => {
      const growth = [75, 60, 45][index % 3]; // Placeholder growth

      // Calculate top 3 popular roles with their job IDs
      const titleCounts = cat.jobs.reduce((acc, job) => {
        acc[job.jobTitle] = acc[job.jobTitle] || { count: 0, ids: [] };
        acc[job.jobTitle].count += 1;
        acc[job.jobTitle].ids.push(job._id);
        return acc;
      }, {});
      const popularRoles = Object.entries(titleCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([title, { ids }]) => ({
          title,
          jobId: ids[0], // Take the first job ID for this title
        }));

      return {
        industry: cat.industry || "Others",
        totalJobs: cat.totalJobs,
        growth,
        popularRoles,
      };
    });

    res.status(200).json(formattedCategories);
  } catch (error) {
    console.error("Error fetching job categories:", error);
    res.status(500).json({ message: "Server error" });
  }
};