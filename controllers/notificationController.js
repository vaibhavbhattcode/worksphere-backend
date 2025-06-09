// controllers/notificationController.js
import Notification from "../models/Notification.js";

export const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate("job", "jobTitle location")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const clearAllNotifications = async (req, res) => {
  try {
    if (req.body.id) {
      await Notification.deleteOne({ _id: req.body.id, user: req.user._id });
      return res.status(200).json({ message: "Notification deleted" });
    }
    await Notification.deleteMany({ user: req.user._id });
    res.status(200).json({ message: "All notifications cleared." });
  } catch (err) {
    console.error("Clear failed", err);
    res.status(500).json({ message: "Server error" });
  }
};
