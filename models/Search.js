// models/Search.js
import mongoose from "mongoose";

const searchSchema = new mongoose.Schema({
  query: { type: String, required: true },
  // If you have user authentication, you can store the user ID.
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

const Search = mongoose.model("Search", searchSchema);

export default Search;
