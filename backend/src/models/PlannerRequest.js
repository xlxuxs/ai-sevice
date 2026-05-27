const mongoose = require("mongoose");

const plannerRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  applicantType: {
    type: String,
    enum: ["citizen", "nonCitizen"],
    default: "citizen",
  },
  fullName: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  region: { type: String, default: "" },
  organization: { type: String, default: "" },
  reason: { type: String, required: true, minlength: 50 },
  proofFile: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PlannerRequest", plannerRequestSchema);
