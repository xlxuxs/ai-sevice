const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/email");

let io = null;

const setSocketIO = (socketIoInstance) => {
  io = socketIoInstance;
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = {},
  severity = "info",
  source = "system",
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const notification = new Notification({
      userId,
      userRole: user.role,
      type,
      title,
      message,
      data,
      severity,
      source,
    });
    await notification.save();

    // Real‑time push via Socket.IO
    if (io) {
      const room = `user:${userId}`;
      io.to(room).emit("notification", notification);
    }

    // Email for important types (you can later make this user‑preference based)
    const emailTypes = [
      "ASSOCIATE_ASSIGNED",
      "MESSAGE_RECEIVED",
      "POLICY_CLOSED",
      "APPEAL_RESOLVED",
      "VOTE_SURGE",
      "RATING_DROP",
    ];
    if (emailTypes.includes(type)) {
      await sendEmail({
        to: user.email,
        subject: title,
        html: `<p><strong>${title}</strong></p><p>${message}</p>`,
      });
    }

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
};

module.exports = { createNotification, setSocketIO };
