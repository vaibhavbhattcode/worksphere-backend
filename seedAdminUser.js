import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const seedAdminUser = async () => {
  try {
    // Connect to the database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      email: "admin@gmail.com",
      isAdmin: true,
    });
    if (existingAdmin) {
      console.log("Admin user already exists.");
      return;
    }

    // Create a new admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const adminUser = new User({
      name: "Admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      isAdmin: true,
    });

    await adminUser.save();
    console.log("Admin user created successfully.");
  } catch (error) {
    console.error("Error seeding admin user:", error);
  } finally {
    // Disconnect from the database
    mongoose.connection.close();
  }
};

seedAdminUser();
