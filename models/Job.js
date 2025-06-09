import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    jobTitle: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
      minlength: [5, "Job title must be at least 5 characters"],
      maxlength: [100, "Job title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Job description is required"],
      trim: true,
      minlength: [20, "Description must be at least 20 characters"],
    },
    jobType: {
      type: String,
      required: [true, "Job type is required"],
      enum: {
        values: [
          "Full-time",
          "Part-time",
          "Contract",
          "Internship",
          "Temporary",
        ],
        message:
          "Job type must be one of: Full-time, Part-time, Contract, Internship, Temporary",
      },
    },
    location: {
      type: String,
      required: [true, "Job location is required"],
      trim: true,
    },
    salary: {
      min: {
        type: Number,
        min: [0, "Minimum salary cannot be negative"],
      },
      max: {
        type: Number,
        min: [0, "Maximum salary cannot be negative"],
      },
      currency: {
        type: String,
        default: "USD",
        uppercase: true,
        trim: true,
      },
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: function (skills) {
          // Limit the number of skills to a maximum of 10
          return skills.length <= 10;
        },
        message: "You can specify up to 10 skills only.",
      },
    },
    experienceLevel: {
      type: String,
      enum: {
        values: ["Entry-level", "Mid-level", "Senior", "Executive"],
        message:
          "Experience level must be one of: Entry-level, Mid-level, Senior, Executive",
      },
    },
    applicationDeadline: {
      type: Date,
      validate: {
        validator: function (value) {
          // Ensure the deadline is in the future
          return value > Date.now();
        },
        message: "Application deadline must be a future date.",
      },
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company", // Stores the Company _id
      required: [true, "Company ID is required"],
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address."],
    },
    benefits: {
      type: [String],
      default: [],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    qualifications: {
      type: [String],
      default: [],
    },
    remoteOption: {
      type: Boolean,
      default: false,
    },
    industry: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["Open", "Closed"],
        message: "Status must be either Open or Closed",
      },
      default: "Open",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Adding a text index for efficient search on job title, description, and location
jobSchema.index({ jobTitle: "text", description: "text", location: "text" });

// Virtual: companyProfile links to the CompanyProfile document whose "company" field matches job.companyId
jobSchema.virtual("companyProfile", {
  ref: "CompanyProfile",
  localField: "companyId",
  foreignField: "company",
  justOne: true,
});

const Job = mongoose.model("Job", jobSchema);

export default Job;
