import Interview from "../models/Interview.js";
import Application from "../models/Application.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

const getJitsiMeetLink = (roomId) => `https://meet.jit.si/${roomId}`;

// Function to format date as "dd mm yyyy"
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
};

// Function to format time as "HH:MM AM/PM"
const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const scheduleInterview = async (req, res) => {
  try {
    const { jobId, userId, applicationId, date, notes } = req.body;

    // 1) Validate inputs
    if (!jobId || !userId || !applicationId || !date) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }
    console.log("Scheduling interview with inputs:", {
      jobId,
      userId,
      applicationId,
      date,
      notes,
    });

    if (
      !mongoose.Types.ObjectId.isValid(jobId) ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(applicationId)
    ) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // 2) Verify the application belongs to this company and populate companyProfile
    const application = await Application.findById(applicationId)
      .populate({
        path: "jobId",
        populate: { path: "companyProfile" }, // Populate the virtual companyProfile
      })
      .populate("userId");
    if (
      !application ||
      application.jobId.companyId.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized or invalid application" });
    }
    console.log("Application found:", {
      applicationId: application._id,
      jobId: application.jobId._id,
      userId: application.userId._id,
      companyId: application.jobId.companyId,
      reqUserId: req.user._id,
      companyName: application.jobId.companyProfile?.companyName || "N/A",
    });

    // 3) Fetch candidate and use application userId if request userId mismatches
    let user = await User.findById(userId);
    const appUserId = application.userId._id.toString();
    if (!user || user._id.toString() !== appUserId) {
      user = application.userId;
      console.log("User ID mismatch: Using application userId", appUserId);
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log("User found:", {
      userId: user._id,
      name: user.name,
      email: user.email,
    });

    // 4) Check for existing interview with application userId
    let isReschedule = false;
    const existingInterview = await Interview.findOne({
      jobId,
      userId: appUserId,
    }).lean();
    console.log("Existing interview check:", {
      existingInterview: existingInterview
        ? {
            id: existingInterview._id,
            jobId: existingInterview.jobId,
            userId: existingInterview.userId,
            applicationId: existingInterview.applicationId,
          }
        : null,
      query: { jobId, userId: appUserId },
      isMatch: existingInterview !== null,
    });
    if (existingInterview) {
      isReschedule = true;
      const deletionResult = await Interview.deleteOne({
        _id: existingInterview._id,
      });
      if (deletionResult.deletedCount === 1) {
        console.log(
          "Successfully deleted existing interview:",
          existingInterview
        );
      } else {
        console.log(
          "No interview deleted, possibly already removed:",
          existingInterview
        );
      }
    } else {
      // Fallback: Check count with application userId
      const priorInterviewCount = await Interview.countDocuments({
        jobId,
        userId: appUserId,
      }).lean();
      if (priorInterviewCount > 0) {
        console.log(
          "Fallback detected prior interview count:",
          priorInterviewCount
        );
        isReschedule = true;
      }
    }

    // 5) Create new interview record
    const jitsiRoomId = `WorkSphere_Interview_${jobId}_${applicationId}_${uuidv4()}`;
    const interview = new Interview({
      jobId,
      userId: user._id,
      applicationId,
      date: new Date(date),
      jitsiRoomId,
      notes,
    });
    await interview.save();
    console.log("Created new interview:", {
      id: interview._id,
      jobId: interview.jobId,
      userId: interview.userId,
      applicationId: interview.applicationId,
      date: interview.date,
    });

    // 6) Send notification email with professional layout
    console.log("Email preparation:", { isReschedule, email: user.email });
    const emailSubject = isReschedule
      ? "Interview Rescheduled - WorkSphere"
      : "Interview Scheduled - WorkSphere";
    const emailGreeting = isReschedule
      ? `Dear ${
          user.name || "Candidate"
        },<br/><br/>We have rescheduled your interview for the position of <strong>${
          application.jobId.jobTitle || "N/A"
        }</strong> at <strong>${
          application.jobId.companyProfile?.companyName || "N/A"
        }</strong>. Please find the updated details below.`
      : `Dear ${
          user.name || "Candidate"
        },<br/><br/>We are pleased to schedule an interview for the position of <strong>${
          application.jobId.jobTitle || "N/A"
        }</strong> at <strong>${
          application.jobId.companyProfile?.companyName || "N/A"
        }</strong>. Please find the details below.`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; color: #1a73e8;">WorkSphere</h1>
        </div>
        <h2 style="color: #1a73e8; font-size: 24px; margin-bottom: 20px;">
          ${isReschedule ? "Interview Rescheduled" : "Interview Scheduled"}
        </h2>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          ${emailGreeting}
        </p>
        <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
          <h3 style="color: #333; font-size: 18px; margin-bottom: 10px;">Interview Details</h3>
          <ul style="list-style: none; padding: 0; color: #555; font-size: 14px;">
            <li style="margin-bottom: 10px;"><strong>Position:</strong> ${
              application.jobId.jobTitle || "N/A"
            }</li>
            <li style="margin-bottom: 10px;"><strong>Company:</strong> ${
              application.jobId.companyProfile?.companyName || "N/A"
            }</li>
            <li style="margin-bottom: 10px;"><strong>Date & Time:</strong> ${formatDate(
              date
            )} at ${formatTime(date)}</li>
            <li style="margin-bottom: 10px;"><strong>Location:</strong> Virtual (via Jitsi Meet)</li>
            <li style="margin-bottom: 10px;"><strong>Join Link:</strong> <a href="${getJitsiMeetLink(
              interview.jitsiRoomId
            )}" style="color: #1a73e8; text-decoration: none;">Join Interview</a></li>
            <li style="margin-bottom: 10px;"><strong>Notes:</strong> ${
              notes || "None"
            }</li>
          </ul>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Please join the interview at the ${
            isReschedule ? "updated" : "scheduled"
          } time using the link above. No account is required—just open it in your browser. ${
      isReschedule ? "Note: The old interview link will not work." : ""
    } For any questions, contact us at <a href="mailto:support@worksphere.com" style="color: #1a73e8; text-decoration: none;">support@worksphere.com</a>.
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 20px;">
          Best regards,<br/>
          The WorkSphere Team
        </p>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #777; font-size: 12px;">
          © 2025 WorkSphere | <a href="https://worksphere.com" style="color: #1a73e8; text-decoration: none;">Website</a> | <a href="https://worksphere.com/privacy" style="color: #1a73e8; text-decoration: none;">Privacy Policy</a>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"WorkSphere" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: emailSubject,
      html: emailBody,
    };

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    await transporter.sendMail(mailOptions);
    console.log("Email sent to:", user.email, "with subject:", emailSubject);

    return res.status(201).json({
      message: isReschedule
        ? "Interview rescheduled successfully"
        : "Interview scheduled successfully",
      interview,
      isReschedule,
    });
  } catch (err) {
    console.error("Error in scheduleInterview:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const getInterviewsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid jobId format" });
    }

    // Verify job belongs to this company
    const job = await Job.findById(jobId);
    if (!job || job.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized or invalid job" });
    }
    console.log("Job found for getInterviewsByJob:", job);

    const interviews = await Interview.find({ jobId })
      .populate("userId", "name email")
      .lean();
    console.log(`Returning interviews for job ${jobId}:`, interviews);
    return res.status(200).json(interviews);
  } catch (err) {
    console.error("Error in getInterviewsByJob:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const cancelInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interviewId format" });
    }
    const interview = await Interview.findById(interviewId)
      .populate("userId")
      .populate({ path: "jobId", populate: { path: "companyProfile" } });
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    // Only allow company to cancel their own interview
    if (interview.jobId.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    interview.status = "cancelled";
    await interview.save();
    // Send cancellation email
    const user = interview.userId;
    const job = interview.jobId;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; color: #1a73e8;">WorkSphere</h1>
        </div>
        <h2 style="color: #e53935; font-size: 24px; margin-bottom: 20px;">Interview Cancelled</h2>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Dear ${user.name || "Candidate"},<br/><br/>
          We regret to inform you that your interview for the position of <strong>${
            job.jobTitle || "N/A"
          }</strong> at <strong>${
      job.companyProfile?.companyName || "N/A"
    }</strong> has been cancelled.<br/><br/>
          If you have any questions, please contact us at <a href="mailto:support@worksphere.com" style="color: #1a73e8; text-decoration: none;">support@worksphere.com</a>.
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 20px;">
          Best regards,<br/>
          The WorkSphere Team
        </p>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #777; font-size: 12px;">
          © 2025 WorkSphere | <a href="https://worksphere.com" style="color: #1a73e8; text-decoration: none;">Website</a> | <a href="https://worksphere.com/privacy" style="color: #1a73e8; text-decoration: none;">Privacy Policy</a>
        </div>
      </div>
    `;
    const mailOptions = {
      from: `"WorkSphere" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Interview Cancelled - WorkSphere",
      html: emailBody,
    };
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    await transporter.sendMail(mailOptions);
    return res
      .status(200)
      .json({ message: "Interview cancelled and candidate notified." });
  } catch (err) {
    console.error("Error in cancelInterview:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
