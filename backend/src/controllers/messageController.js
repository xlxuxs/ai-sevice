const Message = require("../models/Message");
const User = require("../models/User");
const { createAuditLog } = require("../utils/audit");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { sendEmail } = require("../utils/email");
const { createNotification } = require("../services/notificationService");

// Send a message (only planners/admins)
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, subject, body, replyToId } = req.body;
    if (!recipientId || !subject || !body) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "recipientId, subject, body required",
        null,
        400,
      );
    }

    const recipient = await User.findById(recipientId);
    if (
      !recipient ||
      (recipient.role !== "planner" && recipient.role !== "admin")
    ) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Recipient not found or not a planner/admin",
        null,
        404,
      );
    }

    const message = new Message({
      senderId: req.user.id,
      recipientId,
      subject: subject.slice(0, 200),
      body: body.slice(0, 5000),
      replyToId: replyToId || null,
    });
    await message.save();

    // In‑app notification only (no email)
    await createNotification({
      userId: recipientId,
      type: "MESSAGE_RECEIVED",
      title: "New Message from " + req.user.id,
      message: subject,
      data: { messageId: message._id },
    });

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "SEND_MESSAGE",
      targetType: "Message",
      targetId: message._id,
      details: { recipientId, subject },
      req,
    });

    return sendSuccess(res, { messageId: message._id }, "Message sent");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to send message",
      null,
      500,
    );
  }
};

// Get inbox (messages where user is recipient)
exports.getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const messages = await Message.find({ recipientId: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("senderId", "email")
      .populate("replyToId");
    const total = await Message.countDocuments({ recipientId: req.user.id });
    return sendSuccess(
      res,
      { messages, total, page: Number(page) },
      "Inbox retrieved",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve inbox",
      null,
      500,
    );
  }
};

// Get a single message and mark as read
exports.getMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Message not found",
        null,
        404,
      );
    }

    const recipientIdStr = message.recipientId
      ? message.recipientId.toString()
      : "";
    const senderIdStr = message.senderId ? message.senderId.toString() : "";
    const userIdStr = req.user.id.toString();

    if (recipientIdStr !== userIdStr && senderIdStr !== userIdStr) {
      // Do not reveal that the message exists – treat as not found
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Message not found",
        null,
        404,
      );
    }

    if (!message.read && recipientIdStr === userIdStr) {
      message.read = true;
      await message.save();
    }

    await message.populate("senderId", "email");
    await message.populate("recipientId", "email");
    return sendSuccess(res, message, "Message retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve message",
      null,
      500,
    );
  }
};

// Reply to a message
exports.replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    if (!body) {
      return sendError(res, ErrorCodes.VALIDATION, "body required", null, 400);
    }

    const original = await Message.findById(id);
    if (!original) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Original message not found",
        null,
        404,
      );
    }

    const recipientIdStr = original.recipientId
      ? original.recipientId.toString()
      : "";
    const senderIdStr = original.senderId ? original.senderId.toString() : "";
    const userIdStr = req.user.id.toString();

    if (recipientIdStr !== userIdStr && senderIdStr !== userIdStr) {
      // Do not reveal that the original message exists
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Original message not found",
        null,
        404,
      );
    }

    const newRecipientId =
      senderIdStr === userIdStr ? original.recipientId : original.senderId;
    const reply = new Message({
      senderId: req.user.id,
      recipientId: newRecipientId,
      subject: original.subject.startsWith("Re:")
        ? original.subject
        : `Re: ${original.subject}`,
      body,
      replyToId: original._id,
    });
    await reply.save();

    await createNotification({
      userId: newRecipientId,
      type: "MESSAGE_RECEIVED",
      title: "Reply to your message",
      message: original.subject,
      data: { messageId: reply._id },
    });

    return sendSuccess(res, { messageId: reply._id }, "Reply sent");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to send reply",
      null,
      500,
    );
  }
};
