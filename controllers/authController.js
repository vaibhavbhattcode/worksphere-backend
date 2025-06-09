import bcrypt from "bcryptjs";
import Joi from "joi";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import UserProfile from "../models/UserProfile.js";

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

export const registerUser = async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  let { name, email, password } = req.body;
  email = email.toLowerCase();

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(20).toString("hex");

    // Create core user record without the name field
    const user = new User({
      email,
      password: hashedPassword,
      role: "jobSeeker",
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 3600000),
    });
    await user.save();

    // Create the associated profile with the name
    const userProfile = new UserProfile({
      user: user._id,
      name,
    });
    await userProfile.save();

    const verificationUrl = `${
      process.env.BACKEND_URL
    }/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(
      email
    )}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Verify Your Email - Job Portal",
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>Verify Your Email</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f5f7fa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            color: #333333;
            line-height: 1.6;
          }
          .wrapper {
            width: 100%;
            padding: 20px;
            background-color: #f5f7fa;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #2c3e50;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #ffffff;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          .content h2 {
            font-size: 22px;
            color: #2c3e50;
            margin: 0 0 20px;
          }
          .content p {
            font-size: 16px;
            color: #555555;
            margin: 0 0 25px;
          }
          .button {
            display: inline-block;
            background-color: #3498db;
            color: #ffffff !important;
            padding: 14px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            transition: background-color 0.3s ease;
          }
          .button:hover {
            background-color: #2980b9;
          }
          .note {
            font-size: 14px;
            color: #777777;
            margin-top: 20px;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 13px;
            color: #777777;
            border-top: 1px solid #e9ecef;
          }
          .footer a {
            color: #3498db;
            text-decoration: none;
          }
          @media only screen and (max-width: 600px) {
            .wrapper {
              padding: 10px;
            }
            .content {
              padding: 30px 20px;
            }
            .header h1 {
              font-size: 20px;
            }
            .content h2 {
              font-size: 18px;
            }
            .button {
              padding: 12px 25px;
              font-size: 14px;
            }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>Job Portal</h1>
            </div>
            <div class="content">
              <h2>Welcome, ${name}!</h2>
              <p>Thank you for joining Job Portal. To get started, please verify your email address by clicking the button below.</p>
              <a href="${verificationUrl}" class="button">Verify Your Email</a>
              <p class="note">This verification link will expire in 1 hour. If you did not create this account, please ignore this email or contact our support team.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Job Portal. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/support">Contact Support</a> | <a href="${
        process.env.FRONTEND_URL
      }/privacy">Privacy Policy</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `,
      contentType: "text/html",
    };

    await transporter.sendMail(mailOptions);
    return res.status(201).json({
      message: "Registration successful. Please Login.",
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyEmail = async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email)
    return res.status(400).json({ message: "Invalid verification link" });
  const emailLower = email.toLowerCase();

  try {
    const user = await User.findOne({
      email: emailLower,
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link" });
    }
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
  } catch (error) {
    console.error("Email Verification Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  email = email.toLowerCase();

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.password) {
      return res
        .status(400)
        .json({ message: "Use Google login for this account" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Incorrect password" });
    if (!user.isVerified) {
      return res.status(401).json({ message: "Please verify your email" });
    }
    if (user.isActive === false) {
      await sendDeactivationEmail(email);
      return res.status(403).json({
        message: "User account is deactivated. Please contact support.",
      });
    }

    req.login({ id: user._id, type: "user" }, async (err) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      // Fetch associated profile details
      const userProfile = await UserProfile.findOne({ user: user._id });
      const userObj = user.toObject();
      if (userProfile) {
        userObj.name = userProfile.name;
        userObj.profileImage = userProfile.profileImage;
      }
      return res.json({
        message: "Login successful",
        user: userObj,
      });
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendDeactivationEmail = async (email) => {
  try {
    const userProfile = await UserProfile.findOne({
      user: (await User.findOne({ email }))._id,
    });
    const name = userProfile ? userProfile.name : "User";

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Account Deactivated - Job Portal",
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>Account Deactivated</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f5f7fa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            color: #333333;
            line-height: 1.6;
          }
          .wrapper {
            width: 100%;
            padding: 20px;
            background-color: #f5f7fa;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #e74c3c;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #ffffff;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          .content h2 {
            font-size: 22px;
            color: #2c3e50;
            margin: 0 0 20px;
          }
          .content p {
            font-size: 16px;
            color: #555555;
            margin: 0 0 25px;
          }
          .button {
            display: inline-block;
            background-color: #3498db;
            color: #ffffff !important;
            padding: 14px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            transition: background-color 0.3s ease;
          }
          .button:hover {
            background-color: #2980b9;
          }
          .note {
            font-size: 14px;
            color: #777777;
            margin-top: 20px;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 13px;
            color: #777777;
            border-top: 1px solid #e9ecef;
          }
          .footer a {
            color: #3498db;
            text-decoration: none;
          }
          @media only screen and (max-width: 600px) {
            .wrapper {
              padding: 10px;
            }
            .content {
              padding: 30px 20px;
            }
            .header h1 {
              font-size: 20px;
            }
            .content h2 {
              font-size: 18px;
            }
            .button {
              padding: 12px 25px;
              font-size: 14px;
            }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>Job Portal</h1>
            </div>
            <div class="content">
              <h2>Account Deactivated</h2>
              <p>Dear ${name},</p>
              <p>We regret to inform you that your account has been deactivated by the admin. If you believe this is a mistake or would like to reactivate your account, please reach out to our support team.</p>
              <a href="${
                process.env.FRONTEND_URL
              }/support" class="button">Contact Support</a>
              <p class="note">If you have any questions, feel free to reply to this email or visit our support page.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Job Portal. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/support">Contact Support</a> | <a href="${
        process.env.FRONTEND_URL
      }/privacy">Privacy Policy</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `,
      contentType: "text/html",
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Deactivation Email Error:", error);
    throw new Error("Failed to send deactivation email");
  }
};
