import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// Admin Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log("Admin login request received:", { email });
    console.log("Checking database for admin user...");
    console.log("Login request received with email:", email);
    console.log("Checking if admin exists in the database...");

    // Check if the admin exists in the database
    const admin = await User.findOne({ email, isAdmin: true }).select(
      "+password"
    );
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Validate the password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { _id: admin._id, email: admin.email, isAdmin: true },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.json({ token, admin: { id: admin._id, email: admin.email } });
  } catch (error) {
    console.error("Error during admin login:", error);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
});

// Route to add an admin user
router.post("/add", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if the admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the admin user
    const adminUser = new User({
      name,
      email,
      password: hashedPassword,
      isAdmin: true,
      role: "admin",
    });

    await adminUser.save();
    res.status(201).json({ message: "Admin user created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error creating admin user", error });
  }
});

export default router;
