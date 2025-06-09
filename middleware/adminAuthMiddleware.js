import jwt from "jsonwebtoken";
import User from '../models/User.js'; // Use import instead of require
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded._id, isAdmin: true });

    if (!user) {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Authentication failed." });
  }
};

export default adminAuthMiddleware;
