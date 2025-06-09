// controllers/companyAuthController

import bcrypt from "bcryptjs";
import Joi from "joi";
import crypto from "crypto";
import nodemailer from "nodemailer";
import Company from "../models/Company.js";
import CompanyProfile from "../models/CompanyProfile.js";

const registerCompanySchema = Joi.object({
  companyName: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string()
    .pattern(/^[0-9+\s()-]+$/)
    .required(),
  companyAddress: Joi.string().required(),
  industry: Joi.string().required(),
  website: Joi.string().uri().optional().allow(""),
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

export const registerCompany = async (req, res) => {
  const { confirmPassword, ...companyData } = req.body;
  if (confirmPassword !== companyData.password) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  const {
    companyName,
    email,
    password,
    phone,
    companyAddress,
    industry,
    website,
  } = companyData;
  const emailLower = email.toLowerCase();
  try {
    const existingCompany = await Company.findOne({ email: emailLower });
    if (existingCompany)
      return res.status(400).json({ message: "Company already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    // Save company with verification token and expiry
    const company = new Company({
      email: emailLower,
      password: hashedPassword,
      authMethod: "local",
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
    });
    await company.save();
    // Create associated company profile
    const companyProfile = new CompanyProfile({
      company: company._id,
      companyName,
      phone,
      companyAddress,
      website,
      industry,
    });
    await companyProfile.save();
    const verificationUrl = `${
      process.env.BACKEND_URL
    }/api/company/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(
      emailLower
    )}`;
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: emailLower,
      subject: "Verify Your Company Email",
      html: `<p>Hello ${companyName},</p>\n             <p>Please verify your email by clicking: <a href=\"${verificationUrl}\">${verificationUrl}</a></p>\n             <p>Expires in 1 hour.</p>`,
    };
    await transporter.sendMail(mailOptions);
    return res.status(201).json({
      message: "Company registration successful. Please verify your email.",
    });
  } catch (error) {
    console.error("Company Registration Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyCompanyEmail = async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email)
    return res.status(400).json({ message: "Invalid verification link" });
  const emailLower = email.toLowerCase();
  try {
    const company = await Company.findOne({
      email: emailLower,
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });
    if (!company) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link" });
    }
    company.isVerified = true;
    company.verificationToken = undefined;
    company.verificationTokenExpires = undefined;
    await company.save();
    return res.redirect(
      `${process.env.FRONTEND_URL}/company/login?verified=true`
    );
  } catch (error) {
    console.error("Company Email Verification Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Enhanced login with lockout
export const loginCompany = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  email = email.toLowerCase();
  try {
    const company = await Company.findOne({ email }).select("+password");
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (!company.password) {
      return res
        .status(400)
        .json({ message: "Use Google login for this account" });
    }
    // Lockout logic
    if (company.lockUntil && company.lockUntil > Date.now()) {
      const minutes = Math.ceil((company.lockUntil - Date.now()) / 60000);
      return res
        .status(423)
        .json({
          message: `Account locked due to multiple failed login attempts. Try again in ${minutes} minute(s).`,
        });
    }
    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      company.failedLoginAttempts = (company.failedLoginAttempts || 0) + 1;
      if (company.failedLoginAttempts >= 5) {
        company.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lock
        await company.save();
        return res
          .status(423)
          .json({
            message:
              "Account locked due to multiple failed login attempts. Try again in 15 minutes.",
          });
      } else {
        await company.save();
        return res
          .status(401)
          .json({
            message: `Incorrect password. ${
              5 - company.failedLoginAttempts
            } attempt(s) left before lockout.`,
          });
      }
    }
    if (!company.isVerified) {
      return res.status(401).json({ message: "Please verify your email" });
    }
    // Reset failed attempts on successful login
    company.failedLoginAttempts = 0;
    company.lockUntil = undefined;
    await company.save();
    req.login({ id: company._id, type: "company" }, async (err) => {
      if (err) {
        console.error("Company Login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      // Fetch associated company profile details
      const companyProfile = await CompanyProfile.findOne({
        company: company._id,
      });
      const companyObj = company.toObject();
      if (companyProfile) {
        companyObj.companyName = companyProfile.companyName;
        companyObj.phone = companyProfile.phone;
        companyObj.companyAddress = companyProfile.companyAddress;
        companyObj.website = companyProfile.website;
        companyObj.industry = companyProfile.industry;
      }
      return res.json({
        message: "Login successful",
        company: companyObj,
      });
    });
  } catch (error) {
    console.error("Company Login Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resendCompanyVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  const emailLower = email.toLowerCase();
  try {
    const company = await Company.findOne({ email: emailLower });
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (company.isVerified)
      return res.status(400).json({ message: "Company already verified" });
    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    company.verificationToken = verificationToken;
    company.verificationTokenExpires = verificationTokenExpires;
    await company.save();
    // Get company profile for name
    const companyProfile = await CompanyProfile.findOne({
      company: company._id,
    });
    const companyName = companyProfile ? companyProfile.companyName : "Company";
    const verificationUrl = `${
      process.env.BACKEND_URL
    }/api/company/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(
      emailLower
    )}`;
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: emailLower,
      subject: "Verify Your Company Email",
      html: `<p>Hello ${companyName},</p>\n             <p>Please verify your email by clicking: <a href=\"${verificationUrl}\">${verificationUrl}</a></p>\n             <p>Expires in 1 hour.</p>`,
    };
    await transporter.sendMail(mailOptions);
    return res
      .status(200)
      .json({ message: "Verification email resent. Please check your inbox." });
  } catch (error) {
    console.error("Resend Company Verification Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const forgotCompanyPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });
  const emailLower = email.toLowerCase();
  try {
    const company = await Company.findOne({ email: emailLower });
    if (!company)
      return res
        .status(200)
        .json({ message: "If this email exists, a reset link has been sent." });
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    company.resetPasswordToken = resetToken;
    company.resetPasswordExpires = resetTokenExpires;
    await company.save();
    const resetUrl = `${
      process.env.FRONTEND_URL
    }/company/reset-password?token=${resetToken}&email=${encodeURIComponent(
      emailLower
    )}`;
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: emailLower,
      subject: "Reset Your Company Password",
      html: `<p>Hello,</p>\n<p>You requested a password reset. Click the link below to set a new password:</p>\n<p><a href="${resetUrl}">${resetUrl}</a></p>\n<p>If you did not request this, please ignore this email.</p>`,
    };
    await transporter.sendMail(mailOptions);
    return res
      .status(200)
      .json({ message: "If this email exists, a reset link has been sent." });
  } catch (error) {
    console.error("Company Forgot Password Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resetCompanyPassword = async (req, res) => {
  const { token, email, password } = req.body;
  if (!token || !email || !password)
    return res.status(400).json({ message: "Invalid request" });
  const emailLower = email.toLowerCase();
  try {
    const company = await Company.findOne({
      email: emailLower,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!company)
      return res.status(400).json({ message: "Invalid or expired reset link" });
    company.password = await bcrypt.hash(password, 10);
    company.resetPasswordToken = undefined;
    company.resetPasswordExpires = undefined;
    await company.save();
    return res
      .status(200)
      .json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("Company Reset Password Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
