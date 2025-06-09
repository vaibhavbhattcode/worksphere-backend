// controllers/searchController.js
import Search from "../models/Search.js";

export const storeSearch = async (req, res) => {
  try {
    const { query } = req.body;
    // Optionally, include req.user.id if user authentication is enabled.
    const search = new Search({ query, user: req.user ? req.user.id : null });
    await search.save();
    res.status(201).json({ message: "Search stored successfully" });
  } catch (err) {
    console.error("Error storing search:", err);
    res.status(500).json({ message: "Failed to store search" });
  }
};
