import mongoose from "mongoose";
import Company from "./models/Company.js";

const MONGO_URI =
  "mongodb+srv://vaibhavbhatt2022:JUm45C2hWH56gNV5@cluster0.p4x2l.mongodb.net/work-sphere?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your actual MongoDB connection string

async function setCompaniesActive() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    const result = await Company.updateMany(
      { isActive: { $ne: true } },
      { $set: { isActive: true } }
    );

    console.log(`Updated ${result.modifiedCount} companies to active.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error updating companies:", error);
    process.exit(1);
  }
}

setCompaniesActive();
