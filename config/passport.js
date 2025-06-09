// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import UserProfile from "../models/UserProfile.js";
import Company from "../models/Company.js";
import CompanyProfile from "../models/CompanyProfile.js";

// Local strategy for job seekers (user login)
passport.use(
  "local-user",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase() }).select(
          "+password"
        );
        if (!user) {
          return done(null, false, { message: "User not found" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password" });
        }
        return done(null, { id: user.id, type: "user" });
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google strategy for job seekers
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile.emails || !profile.emails.length) {
          return done(new Error("No email found in Google profile"), null);
        }
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
          user = new User({
            email: profile.emails[0].value,
            googleId: profile.id,
            authMethod: "google",
          });
          await user.save();
          // Create associated UserProfile
          const userProfile = new UserProfile({
            user: user._id,
            name: profile.displayName,
          });
          await userProfile.save();
        }
        if (user.isActive === false) {
          return done(new Error("User account is deactivated. Please contact support."), null);
        }
        return done(null, { id: user.id, type: "user" });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Google strategy for companies (unchanged)
passport.use(
  "google-company",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/company/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile.emails || !profile.emails.length) {
          return done(new Error("No email found in Google profile"), null);
        }
        let company = await Company.findOne({ email: profile.emails[0].value });
        if (!company) {
          company = new Company({
            email: profile.emails[0].value,
            googleId: profile.id,
            authMethod: "google",
            isVerified: true,
          });
          await company.save();
          const companyProfile = new CompanyProfile({
            company: company._id,
            companyName: profile.displayName,
            phone: "",
            companyAddress: "",
          });
          await companyProfile.save();
        }
        return done(null, { id: company.id, type: "company" });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((userData, done) => {
  done(null, userData);
});

passport.deserializeUser(async (sessionData, done) => {
  try {
    if (!sessionData || !sessionData.id || !sessionData.type) {
      return done(null, null);
    }
    if (sessionData.type === "company") {
      const company = await Company.findById(sessionData.id);
      return done(null, company);
    } else if (sessionData.type === "user") {
      const user = await User.findById(sessionData.id);
      return done(null, user);
    }
    return done(null, null);
  } catch (error) {
    done(error, null);
  }
});
