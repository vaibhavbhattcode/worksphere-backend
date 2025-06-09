import AuditLog from "../models/AuditLog.js";

const logAdminAction = async (action, performedBy, details = {}) => {
  try {
    await AuditLog.create({ action, performedBy, details });
  } catch (error) {
    console.error("Error logging admin action:", error);
  }
};

export default logAdminAction;
