// controllers/savedJobController.js
import SavedJob from "../models/SavedJob.js";

export const saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;
    const existingSave = await SavedJob.findOne({ user: userId, job: jobId });
    if (existingSave) {
      return res.status(400).json({ message: "Job already saved." });
    }
    const savedJob = new SavedJob({ user: userId, job: jobId });
    await savedJob.save();
    return res.status(201).json({ message: "Job saved successfully!" });
  } catch (error) {
    console.error("Error saving job:", error);
    return res.status(500).json({ message: "Error saving job", error });
  }
};

export const removeSavedJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;
    const removedJob = await SavedJob.findOneAndDelete({
      user: userId,
      job: jobId,
    });
    if (!removedJob) {
      return res.status(404).json({ message: "Saved job not found." });
    }
    return res.status(200).json({ message: "Job removed from saved jobs." });
  } catch (error) {
    console.error("Error removing saved job:", error);
    return res.status(500).json({ message: "Error removing job", error });
  }
};

/**
 * GET /api/user/saved-jobs
 * Returns an array of saved docs, each with a nested `job` that includes
 * merged `companyName` and `companyLogo`. If a company logo isn’t uploaded,
 * it falls back to "/demo.png".
 */
export const getSavedJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    // Populate the "job" field, then within that populate the virtual "companyProfile"
    const savedJobs = await SavedJob.find({ user: userId }).populate({
      path: "job",
      model: "Job",
      populate: {
        path: "companyProfile",
        select: "companyName logo",
      },
    });

    // Transform each record so that the job object has companyName and companyLogo merged in.
    const transformed = savedJobs.map((savedDoc) => {
      if (!savedDoc.job) return savedDoc;
      const jobObj = savedDoc.job.toObject();
      const { companyProfile, ...restOfJob } = jobObj;
      const mergedJob = {
        ...restOfJob,
        companyName: companyProfile?.companyName || "Unknown Company",
        companyLogo:
          companyProfile &&
          companyProfile.logo &&
          companyProfile.logo.trim() !== ""
            ? companyProfile.logo
            : "/demo.png",
      };
      return {
        ...savedDoc.toObject(),
        job: mergedJob,
      };
    });

    return res.status(200).json(transformed);
  } catch (error) {
    console.error("Error fetching saved jobs:", error);
    return res
      .status(500)
      .json({ message: "Error fetching saved jobs", error });
  }
};
