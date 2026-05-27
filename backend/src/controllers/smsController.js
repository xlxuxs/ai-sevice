const Policy = require("../models/Policy");
const Vote = require("../models/Vote");
const User = require("../models/User");
const SmsSubscription = require("../models/SmsSubscription");
const { hashPhone, normalizePhone } = require("../utils/helpers");
const client = require("../config/redis");
const logger = require("../utils/logger");

const RATE_LIMIT = 3;
const RATE_WINDOW = 24 * 60 * 60;

const getPolicyStats = async (policyId) => {
  const votes = await Vote.find({ policyId });
  const totalVotes = votes.length;
  const totalRating = votes.reduce((sum, v) => sum + v.rating, 0);
  const avgRating = totalVotes > 0 ? (totalRating / totalVotes).toFixed(2) : 0;
  return { avgRating, totalVotes };
};

// Helper to send plain text response with optional status code
const sendText = (res, message, statusCode = 200) => {
  res.status(statusCode).send(message);
};

exports.receiveSms = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      logger.warn("SMS request missing phone or message");
      return sendText(res, "Phone and message are required", 400);
    }

    const trimmed = message.trim().toUpperCase();
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    // Find or create subscription record (default not subscribed)
    let subscription = await SmsSubscription.findOne({ phoneHash });
    const isSubscribed = subscription ? subscription.subscribed : false;

    // Handle SUBSCRIBE command (always allowed)
    if (trimmed === "SUBSCRIBE") {
      if (!subscription) {
        subscription = new SmsSubscription({ phoneHash, subscribed: true });
        await subscription.save();
      } else if (!subscription.subscribed) {
        subscription.subscribed = true;
        subscription.unsubscribedAt = null;
        await subscription.save();
      } else {
        // already subscribed
        return sendText(res, "You are already subscribed to SMS voting.");
      }
      logger.info(`SMS subscribed: ${normalized}`);
      return sendText(
        res,
        "Welcome to the Civic Engagement SMS service.\n" +
          "You can now vote on policies, check status, and receive closure notifications.\n" +
          "Send HELP for available commands.",
      );
    }

    // Handle STOP / UNSUBSCRIBE command
    if (trimmed === "STOP" || trimmed === "UNSUBSCRIBE") {
      if (!subscription || !subscription.subscribed) {
        return sendText(res, "You are not currently subscribed.");
      }
      subscription.subscribed = false;
      subscription.unsubscribedAt = new Date();
      await subscription.save();
      logger.info(`SMS unsubscribed: ${normalized}`);
      return sendText(
        res,
        "You have unsubscribed from SMS voting. You will no longer receive notifications or be able to vote. Send SUBSCRIBE to rejoin.",
      );
    }

    // If not subscribed and command is not SUBSCRIBE/STOP, reject
    if (!isSubscribed) {
      return sendText(
        res,
        "You are not subscribed to this service. Send SUBSCRIBE to register for SMS voting.",
      );
    }

    // ========== SUBSCRIBED USERS ONLY BEYOND THIS POINT ==========

    // HELP command
    if (trimmed === "HELP") {
      logger.info(`SMS HELP from ${phone}`);
      return sendText(
        res,
        "Commands:\n" +
          "SUBSCRIBE - Register for SMS voting\n" +
          "STOP - Unsubscribe\n" +
          "POLICIES - List active policies\n" +
          "STATUS <code> - Current average rating\n" +
          "RATE <code> <1-5> - Vote (max 3 per day)\n" +
          "MYVOTES - Policies you voted on\n" +
          "RESULTS <code> - Final results (closed policy)\n" +
          "HELP - This message",
      );
    }

    // POLICIES
    if (trimmed === "POLICIES") {
      const now = new Date();
      const policies = await Policy.find({
        status: "active",
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).select("policyCode title");
      if (policies.length === 0) {
        return sendText(res, "No active policies available at the moment.");
      }
      const list = policies
        .map((p) => `${p.policyCode} - ${p.title}`)
        .join("\n");
      return sendText(res, `Active policies:\n${list}`);
    }

    // STATUS
    const statusMatch = trimmed.match(/^STATUS\s+(\S+)$/i);
    if (statusMatch) {
      const policyCode = statusMatch[1];
      const policy = await Policy.findOne({ policyCode, status: "active" });
      if (!policy) {
        return sendText(res, "Policy not found or not active.", 404);
      }
      const { avgRating, totalVotes } = await getPolicyStats(policy._id);
      return sendText(
        res,
        `Policy: ${policy.title}\nAverage rating: ${avgRating} stars (${totalVotes} votes)`,
      );
    }

    // RATE
    const rateMatch = trimmed.match(/^RATE\s+(\S+)\s+([1-5])$/i);
    if (rateMatch) {
      const policyCode = rateMatch[1];
      const rating = parseInt(rateMatch[2], 10);
      const policy = await Policy.findOne({ policyCode, status: "active" });
      if (!policy) {
        logger.warn(`SMS vote for invalid policy: ${policyCode}`);
        return sendText(res, "Policy not found or not active.", 404);
      }

      // Check if this phone is registered as an app user (verified)
      const existingUser = await User.findOne({ phoneHash, verified: true });
      if (existingUser) {
        return sendText(
          res,
          "This number is registered with the app. Please use the app to vote.",
          403,
        );
      }

      // Duplicate vote
      const existingVote = await Vote.findOne({
        policyId: policy._id,
        phoneHash,
      });
      if (existingVote) {
        return sendText(
          res,
          "You have already voted on this policy via SMS.",
          409,
        );
      }

      // Rate limiting
      const rateKey = `rate:sms:${phoneHash}:${new Date().toISOString().split("T")[0]}`;
      const current = await client.incr(rateKey);
      if (current === 1) await client.expire(rateKey, RATE_WINDOW);
      if (current > RATE_LIMIT) {
        const ttl = await client.ttl(rateKey);
        const hours = Math.ceil(ttl / 3600);
        return sendText(
          res,
          `Daily limit of ${RATE_LIMIT} votes reached. Try again in ${hours} hour(s).`,
          429,
        );
      }

      // Save vote
      const vote = new Vote({
        policyId: policy._id,
        phoneHash,
        channel: "sms",
        rating,
      });
      await vote.save();
      const { avgRating, totalVotes } = await getPolicyStats(policy._id);
      const remaining = RATE_LIMIT - current;
      logger.info(`SMS vote: ${normalized} rated ${rating} for ${policyCode}`);
      return sendText(
        res,
        `You voted ${rating} stars for "${policy.title}".\nCurrent average: ${avgRating} stars (${totalVotes} votes).\n${remaining} vote(s) left today.`,
      );
    }

    // MYVOTES
    if (trimmed === "MYVOTES") {
      const votes = await Vote.find({ phoneHash }).populate(
        "policyId",
        "title policyCode status endDate",
      );
      if (votes.length === 0) {
        return sendText(res, "You haven't voted on any policies yet.");
      }
      const lines = [];
      for (const vote of votes) {
        const policy = vote.policyId;
        if (!policy) continue;
        let statusText = "";
        if (policy.status === "closed") {
          const { avgRating } = await getPolicyStats(policy._id);
          statusText = `Closed - final rating: ${avgRating} stars`;
        } else if (policy.status === "active") {
          statusText = "Active - voting open";
        } else if (policy.status === "paused") {
          statusText = "Paused - voting temporarily stopped";
        } else {
          statusText = `${policy.status} - not open for voting`;
        }
        lines.push(`${policy.policyCode} (${policy.title}): ${statusText}`);
      }
      return sendText(res, `Policies you voted on:\n${lines.join("\n")}`);
    }

    // RESULTS
    const resultsMatch = trimmed.match(/^RESULTS\s+(\S+)$/i);
    if (resultsMatch) {
      const policyCode = resultsMatch[1];
      const policy = await Policy.findOne({ policyCode, status: "closed" });
      if (!policy) {
        return sendText(res, "Policy not found or not yet closed.", 404);
      }
      const { avgRating, totalVotes } = await getPolicyStats(policy._id);
      return sendText(
        res,
        `Policy: ${policy.title}\nFinal average rating: ${avgRating} stars (${totalVotes} votes)`,
      );
    }

    // Unknown command
    logger.warn(`Unknown SMS command from ${normalized}: ${message}`);
    return sendText(
      res,
      "Unknown command. Send HELP for available commands.",
      400,
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "SMS receive error");
    sendText(res, "Server error", 500);
  }
};

// Keep getResults unchanged (for web compatibility)
exports.getResults = async (req, res) => {
  try {
    const { phone, code } = req.query;
    if (!code) {
      return sendText(res, "Policy code is required", 400);
    }
    const policy = await Policy.findOne({ policyCode: code, status: "closed" });
    if (!policy) {
      return sendText(res, "Policy not found or not yet closed", 404);
    }
    const { avgRating, totalVotes } = await getPolicyStats(policy._id);
    sendText(
      res,
      `Policy: ${policy.title} – Final average rating: ${avgRating} stars (${totalVotes} votes)`,
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "SMS results error");
    sendText(res, "Server error", 500);
  }
};
