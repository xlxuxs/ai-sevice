const mongoose = require("mongoose");

const smsSubscriptionSchema = new mongoose.Schema({
  phoneHash: { type: String, required: true, unique: true },
  subscribed: { type: Boolean, default: true }, // after SUBSCRIBE becomes true
  subscribedAt: { type: Date, default: Date.now },
  unsubscribedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SmsSubscription", smsSubscriptionSchema);
