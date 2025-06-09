// routes/searchRoutes.js
import express from "express";
import { storeSearch } from "../controllers/searchController.js";

const router = express.Router();

router.post("/", storeSearch);

export default router;
