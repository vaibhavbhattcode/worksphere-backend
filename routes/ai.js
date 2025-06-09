import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const router = express.Router();

import UserProfile from "../models/UserProfile.js";
import Experience from "../models/Experience.js";
import Education from "../models/Education.js";
import Certificate from "../models/Certificate.js";
import Skill from "../models/Skill.js";

import { isUserAuthenticated } from "../middleware/userAuthMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 🔹 POST /api/ai/generate-about */
router.post("/generate-about", async (req, res) => {
  const { jobTitle, skills } = req.body;

  const skillsArray = Array.isArray(skills)
    ? skills
    : skills
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (!jobTitle || !skillsArray?.length) {
    return res
      .status(400)
      .json({ error: "Job title and skills are required." });
  }

  const prompt = `Generate a professional 'About Me' section for a job seeker with the title '${jobTitle}' and skills: ${skillsArray.join(
    ", "
  )}. Keep it concise, human-readable, under 100 words, and without markdown.`;

  try {
    const response = await axios.post(
      "https://chatgpt-42.p.rapidapi.com/chatgpt",
      {
        messages: [{ role: "user", content: prompt }],
        web_access: false,
      },
      {
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
          "Content-Type": "application/json",
        },
      }
    );

    let text =
      response.data?.result ||
      response.data?.response?.message?.content ||
      response.data?.output ||
      response.data ||
      "Unable to generate text.";
    text = text
      .replace(/\*\*/g, "")
      .replace(/[\r\n]+/g, " ")
      .trim();

    const words = text.split(/\s+/);
    if (words.length > 100) text = words.slice(0, 100).join(" ") + "...";

    res.json({ about: text });
  } catch (err) {
    console.error("AI Error (generate-about):", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data,
    });
    res.status(500).json({ error: "Failed to generate About Me text." });
  }
});


/** 🔹 POST /api/ai/career-suggestions */
router.post("/career-suggestions", isUserAuthenticated, async (req, res) => {
  const { skills = [], experience = [] } = req.body;

  if (!skills.length && !experience.length) {
    return res
      .status(400)
      .json({ message: "Skills or experience must be provided." });
  }

  const experienceText = experience
    .map((e) => `${e.position || ""} at ${e.company || ""}`)
    .join("; ");

  const prompt = `
You are a career coach AI.
Based on these skills: ${skills.join(", ")}
And experience: ${experienceText}
Suggest:
- 3 suitable job roles
- 3 trending/advanced skills to learn
- 3 useful online courses with platforms and benefits
Format each section as a bullet list.
`;

  try {
    const response = await axios.post(
      "https://chatgpt-42.p.rapidapi.com/chatgpt",
      {
        messages: [{ role: "user", content: prompt }],
        web_access: false,
      },
      {
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
          "Content-Type": "application/json",
        },
      }
    );

    let suggestions =
      response.data?.result ||
      response.data?.response?.message?.content ||
      response.data?.output ||
      response.data ||
      "No suggestions available.";
    suggestions = suggestions.replace(/\*\*/g, "").trim();

    res.status(200).json({ suggestions });
  } catch (err) {
    console.error("AI Error (career-suggestions):", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data,
    });
    res.status(500).json({ message: "Failed to generate career suggestions." });
  }
});

export default router;
