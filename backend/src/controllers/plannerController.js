const User = require("../models/User");
const PlannerRequest = require("../models/PlannerRequest");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");
const { createAuditLog } = require("../utils/audit");
const { createNotification } = require("../services/notificationService");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { sendEmail } = require("../utils/email");

// Helper: convert permission keys to user‑friendly labels
const formatPermissions = (perms) => {
  const map = {
    moderate_comments: "Moderate Comments",
    reply_official: "Official Replies",
    export_data: "Export Data",
  };
  return perms.map((p) => map[p] || p).join(", ");
};

// ==================== CITIZEN REQUESTS TO BECOME PLANNER ====================
exports.requestPlanner = async (req, res) => {
  try {
    const {
      organization,
      reason,
      proofFile,
      applicantType,
      fullName,
      email,
      phone,
      region,
    } = req.body;
    if (!reason || reason.length < 50) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Reason must be at least 50 characters.",
        null,
        400,
      );
    }
    const userId = req.user?.id || null;
    const isCitizenRequest = !!userId;

    if (!isCitizenRequest) {
      if (!fullName || !email || !region) {
        return sendError(
          res,
          ErrorCodes.VALIDATION,
          "Full name, email, and region are required for planner requests without login.",
          null,
          400,
        );
      }
    }

    const existing = await PlannerRequest.findOne(
      isCitizenRequest
        ? { userId, status: "pending" }
        : { email: email.trim().toLowerCase(), status: "pending" },
    );
    if (existing) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "You already have a pending request. Please wait for admin review.",
        null,
        409,
      );
    }
    const request = new PlannerRequest({
      userId,
      applicantType:
        applicantType === "citizen" || isCitizenRequest
          ? "citizen"
          : "nonCitizen",
      fullName: fullName || "",
      email: email ? email.trim().toLowerCase() : "",
      phone: phone || "",
      region: region || "",
      organization: organization || "",
      reason,
      proofFile: proofFile || null,
    });
    await request.save();
    if (userId) {
      await createAuditLog({
        userId,
        userRole: "citizen",
        action: "PLANNER_REQUEST_CREATED",
        details: { organization, reasonPreview: reason.slice(0, 100) },
        req,
      });
    }
    return sendSuccess(
      res,
      { requestId: request._id },
      "Your request has been submitted. Admins will review it.",
      201,
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to submit request. Please try again.",
      null,
      500,
    );
  }
};

// ==================== ADMIN ENDPOINTS ====================
exports.listPendingRequests = async (req, res) => {
  try {
    const requests = await PlannerRequest.find({ status: "pending" })
      .populate(
        "userId",
        "email region ageRange gender occupation education createdAt",
      )
      .sort({ createdAt: -1 });
    return sendSuccess(res, requests);
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to fetch requests",
      null,
      500,
    );
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await PlannerRequest.findById(id);
    if (!request)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Request not found",
        null,
        404,
      );
    if (request.status !== "pending")
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Request already ${request.status}`,
        null,
        400,
      );
    if (!request.userId) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "This request is not linked to an existing citizen account. Create the planner account manually or ask the applicant to register first.",
        null,
        400,
      );
    }
    const user = await User.findById(request.userId);
    if (!user)
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    user.role = "planner";
    user.tokenVersion += 1;
    await user.save();
    request.status = "approved";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();
    await createAuditLog({
      userId: user._id,
      userRole: "admin",
      action: "PLANNER_APPROVED",
      details: { approvedBy: req.user.id },
      req,
    });
    await sendEmail({
      to: user.email,
      subject: "Planner Request Approved",
      html: `<p>Congratulations! You are now a planner. Please log in and complete the mandatory training before creating policies.</p>`,
    });
    // In‑app notification
    await createNotification({
      userId: user._id,
      type: "PLANNER_APPROVED",
      title: "Planner Request Approved",
      message: `Congratulations! You are now a planner. Please log in and complete the mandatory training.`,
      data: {},
      severity: "info",
      source: "system",
    });
    return sendSuccess(
      res,
      null,
      "Planner request approved. User role updated.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to approve request",
      null,
      500,
    );
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    if (!rejectionReason || rejectionReason.length < 10)
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Rejection reason must be at least 10 characters.",
        null,
        400,
      );
    const request = await PlannerRequest.findById(id);
    if (!request)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Request not found",
        null,
        404,
      );
    if (request.status !== "pending")
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Request already ${request.status}`,
        null,
        400,
      );
    request.status = "rejected";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason;
    await request.save();
    const user = await User.findById(request.userId);
    if (user) {
      await sendEmail({
        to: user.email,
        subject: "Planner Request Rejected",
        html: `<p>Your request to become a planner was rejected. Reason: ${rejectionReason}</p>`,
      });
    }
    await createAuditLog({
      userId: req.user.id,
      userRole: "admin",
      action: "PLANNER_REJECTED",
      details: { requestId: id, reason: rejectionReason },
      req,
    });
    return sendSuccess(res, null, "Request rejected.");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to reject request",
      null,
      500,
    );
  }
};

// ==================== TRAINING COMPLETION (PLANNER ONLY) ====================
exports.completeTraining = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "planner")
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only planners can complete training.",
        null,
        403,
      );
    if (user.trainingCompletedAt)
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Training already completed.",
        null,
        400,
      );
    const completedAt = new Date();
    await User.updateOne(
      { _id: user._id },
      { $set: { trainingCompletedAt: completedAt } },
      { runValidators: false },
    );
    await createAuditLog({
      userId: user._id,
      userRole: "planner",
      action: "TRAINING_COMPLETED",
      details: {},
      req,
    });
    return sendSuccess(
      res,
      null,
      "Training completed. You can now create policies.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to complete training",
      null,
      500,
    );
  }
};

// ========== SEARCH PLANNERS BY LANGUAGE ==========
exports.searchPlannersByLanguage = async (req, res) => {
  try {
    const { language } = req.query;

    let query = { role: "planner", active: true, deletedAt: null };

    if (
      language &&
      language !== "all" &&
      ["am", "om", "ti", "en"].includes(language)
    ) {
      query.languagesSpoken = language;
    }

    const planners = await User.find(query)
      .select("email region languagesSpoken trainingCompletedAt")
      .limit(50);
    return sendSuccess(res, planners, "Planners found");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to search planners",
      null,
      500,
    );
  }
};

// ========== ASSOCIATE ==========

exports.addAssociate = async (req, res) => {
  try {
    const { policyId } = req.params;
    const { plannerEmail, permissions } = req.body;

    if (!plannerEmail || !permissions || !permissions.length) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "plannerEmail and permissions array required",
        null,
        400,
      );
    }

    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can add associates",
        null,
        403,
      );
    }

    const associateUser = await User.findOne({
      email: plannerEmail,
      role: "planner",
      active: true,
    });
    if (!associateUser) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Planner not found with that email",
        null,
        404,
      );
    }

    if (
      associateUser._id.toString() === req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "You cannot assign yourself as associate",
        null,
        400,
      );
    }

    const existing = await PolicyAssociate.findOne({
      policyId,
      plannerId: associateUser._id,
      invitationStatus: { $in: ["pending", "accepted"] },
    });
    if (existing) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        `This planner already has a ${existing.invitationStatus} invitation/association for this policy.`,
        null,
        409,
      );
    }

    const associate = new PolicyAssociate({
      policyId,
      plannerId: associateUser._id,
      permissions,
      assignedBy: req.user.id,
    });
    await associate.save();

    // In‑app notification with formatted permissions
    await createNotification({
      userId: associateUser._id,
      type: "ASSOCIATE_INVITED",
      title: "Policy Associate Invitation",
      message: `You have been invited to become an associate on policy "${policy.title}" with permissions: ${formatPermissions(permissions)}. It expires on ${associate.expiresAt.toLocaleDateString()}.`,
      data: { policyId, associateId: associate._id, permissions },
      severity: "info",
      source: "system",
    });

    // Email with formatted permissions
    const acceptUrl = `${process.env.FRONTEND_URL}/associates/invitation/${associate._id}?action=accept`;
    const rejectUrl = `${process.env.FRONTEND_URL}/associates/invitation/${associate._id}?action=reject`;
    await sendEmail({
      to: associateUser.email,
      subject: `Invitation to become an associate for policy: ${policy.title}`,
      html: `<p>You have been invited by ${req.user.email} to help manage policy "${policy.title}".</p>
             <p>Permissions: ${formatPermissions(permissions)}.</p>
             <p>This invitation expires on ${associate.expiresAt.toLocaleDateString()}.</p>
             <p><a href="${acceptUrl}">Accept Invitation</a> | <a href="${rejectUrl}">Reject Invitation</a></p>
             <p>If you accept, you will be able to act according to the permissions above. If you reject, no further action is needed.</p>`,
    });

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "ADD_ASSOCIATE",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: {
        policyId,
        plannerId: associateUser._id,
        permissions,
        expiresAt: associate.expiresAt,
      },
      req,
    });

    return sendSuccess(
      res,
      { associateId: associate._id, expiresAt: associate.expiresAt },
      "Invitation sent. The associate must accept before it expires.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to add associate",
      null,
      500,
    );
  }
};

// ========== LIST ASSOCIATES (for a policy) ==========
exports.listAssociates = async (req, res) => {
  try {
    const { policyId } = req.params;
    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can view associates",
        null,
        403,
      );
    }

    const associates = await PolicyAssociate.find({ policyId })
      .populate("plannerId", "email region languagesSpoken firstName lastName")
      .populate("assignedBy", "email firstName lastName")
      .populate("revokedBy", "email")
      .sort({ createdAt: -1 });

    const enriched = associates.map((a) => ({
      ...a.toObject(),
      displayStatus: a.displayStatus,
      daysRemaining: a.isPending ? a.daysRemaining : null,
    }));

    return sendSuccess(res, enriched, "Associates retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to list associates",
      null,
      500,
    );
  }
};

// ========== UPDATE ASSOCIATE PERMISSIONS ==========
exports.updateAssociatePermissions = async (req, res) => {
  try {
    const { policyId, associateId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !permissions.length) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "permissions array required",
        null,
        400,
      );
    }

    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can update permissions",
        null,
        403,
      );
    }

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      policyId,
    });
    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Associate record not found",
        null,
        404,
      );
    }

    await associate.updatePermissions(permissions, req.user.id);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_ASSOCIATE_PERMISSIONS",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { permissions },
      req,
    });

    await createNotification({
      userId: associate.plannerId,
      type: "ASSOCIATE_PERMISSIONS_UPDATED",
      title: "Permissions Updated",
      message: `Your permissions for policy "${policy.title}" have been updated to: ${formatPermissions(permissions)}.`,
      data: { policyId, permissions },
      severity: "info",
      source: "system",
    });

    return sendSuccess(res, associate, "Permissions updated");
  } catch (err) {
    console.error(err);
    const message = err.message || "Failed to update permissions";
    return sendError(res, ErrorCodes.INTERNAL, message, null, 500);
  }
};

// ========== REVOKE ASSOCIATE (owner or admin) ==========
exports.revokeAssociate = async (req, res) => {
  try {
    const { policyId, associateId } = req.params;
    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can revoke associates",
        null,
        403,
      );
    }

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      policyId,
    });
    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Associate record not found",
        null,
        404,
      );
    }

    const wasPending = associate.invitationStatus === "pending";
    const revocationReason =
      req.user.role === "admin" ? "admin_revoked" : "owner_revoked";
    await associate.revoke(req.user.id, revocationReason);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "REVOKE_ASSOCIATE",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: {
        policyId,
        plannerId: associate.plannerId,
        reason: revocationReason,
        wasPending,
      },
      req,
    });

    if (wasPending) {
      await createNotification({
        userId: associate.plannerId,
        type: "ASSOCIATE_INVITATION_CANCELLED",
        title: "Invitation Cancelled",
        message: `Your invitation to become an associate for policy "${policy.title}" has been cancelled by the policy owner.`,
        data: { policyId: policy._id, associateId: associate._id },
        severity: "info",
        source: "system",
      });
    } else {
      await createNotification({
        userId: associate.plannerId,
        type: "ASSOCIATE_REVOKED",
        title: "Associate Role Revoked",
        message: `You have been removed as an associate from policy "${policy.title}".`,
        data: { policyId },
        severity: "info",
        source: "system",
      });
    }

    const successMessage = wasPending
      ? "Invitation cancelled"
      : "Associate revoked successfully";
    return sendSuccess(res, null, successMessage);
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to revoke associate",
      null,
      500,
    );
  }
};

// ========== ACCEPT INVITATION ==========
exports.acceptAssociateInvitation = async (req, res) => {
  try {
    const { associateId } = req.params;

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      plannerId: req.user.id,
    }).populate("policyId");

    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Invitation not found",
        null,
        404,
      );
    }

    if (!associate.isPending) {
      let msg = `Invitation cannot be accepted. Current status: ${associate.displayStatus}`;
      if (associate.displayStatus === "expired")
        msg = "This invitation has expired.";
      return sendError(res, ErrorCodes.VALIDATION, msg, null, 400);
    }

    await associate.accept(req.user.id);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "ACCEPT_ASSOCIATE_INVITATION",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { policyId: associate.policyId._id },
      req,
    });

    if (associate.policyId) {
      await createNotification({
        userId: associate.policyId.createdBy,
        type: "ASSOCIATE_ACCEPTED",
        title: "Associate Accepted Invitation",
        message: `${req.user.email} has accepted the invitation for policy "${associate.policyId.title}".`,
        data: { policyId: associate.policyId._id, associateId: associate._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(
      res,
      null,
      "Invitation accepted. You now have access to the policy.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to accept invitation",
      null,
      500,
    );
  }
};

// ========== REJECT INVITATION ==========
exports.rejectAssociateInvitation = async (req, res) => {
  try {
    const { associateId } = req.params;
    const { rejectionReason } = req.body;

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      plannerId: req.user.id,
    }).populate("policyId");

    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Invitation not found",
        null,
        404,
      );
    }

    if (!associate.isPending) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Invitation cannot be rejected. Current status: ${associate.displayStatus}`,
        null,
        400,
      );
    }

    await associate.reject(req.user.id, rejectionReason || null);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "REJECT_ASSOCIATE_INVITATION",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { policyId: associate.policyId._id, reason: rejectionReason },
      req,
    });

    if (associate.policyId) {
      await createNotification({
        userId: associate.policyId.createdBy,
        type: "ASSOCIATE_REJECTED",
        title: "Associate Rejected Invitation",
        message: `${req.user.email} has declined the invitation for policy "${associate.policyId.title}".`,
        data: { policyId: associate.policyId._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(res, null, "Invitation rejected.");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to reject invitation",
      null,
      500,
    );
  }
};

// ========== SELF REVOKE (associate leaves) ==========
exports.revokeSelfAsAssociate = async (req, res) => {
  try {
    const { associateId } = req.params;

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      plannerId: req.user.id,
      invitationStatus: "accepted",
      revokedAt: null,
    }).populate("policyId");

    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Active associate record not found",
        null,
        404,
      );
    }

    await associate.revoke(req.user.id, "self_revoked");

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "SELF_REVOKE_ASSOCIATE",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { policyId: associate.policyId._id },
      req,
    });

    if (associate.policyId) {
      await createNotification({
        userId: associate.policyId.createdBy,
        type: "ASSOCIATE_SELF_REVOKED",
        title: "Associate Left",
        message: `${req.user.email} has removed themselves as an associate from policy "${associate.policyId.title}".`,
        data: { policyId: associate.policyId._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(res, null, "You have been removed as an associate.");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to revoke associate status",
      null,
      500,
    );
  }
};

// ========== GET POLICIES WHERE USER IS AN ACCEPTED ASSOCIATE ==========
exports.getMyAssociatePolicies = async (req, res) => {
  try {
    const associates = await PolicyAssociate.find({
      plannerId: req.user.id,
      invitationStatus: "accepted",
      revokedAt: null,
    })
      .populate(
        "policyId",
        "title policyCode status targetRegions pollType createdAt",
      )
      .populate("assignedBy", "email firstName lastName")
      .sort({ acceptedAt: -1 });

    const policies = associates.map((assoc) => ({
      associateId: assoc._id,
      policy: assoc.policyId,
      permissions: assoc.permissions,
      assignedBy: assoc.assignedBy,
      acceptedAt: assoc.acceptedAt,
    }));

    return sendSuccess(res, policies, "Delegated policies retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve delegated policies",
      null,
      500,
    );
  }
};

// ========== GET PENDING INVITATIONS FOR CURRENT PLANNER ==========
exports.getPendingInvitations = async (req, res) => {
  try {
    const invitations = await PolicyAssociate.findPendingInvitations(
      req.user.id,
    );
    return sendSuccess(res, invitations, "Pending invitations retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve pending invitations",
      null,
      500,
    );
  }
};

// ========== GET SINGLE INVITATION DETAILS (for preview) ==========
exports.getInvitationDetails = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await PolicyAssociate.findOne({
      _id: invitationId,
      plannerId: req.user.id,
      invitationStatus: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate(
        "policyId",
        "title description policyCode status startDate endDate pollType",
      )
      .populate("assignedBy", "email firstName lastName");

    if (!invitation) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Invitation not found, already processed, or expired",
        null,
        404,
      );
    }

    const enriched = {
      ...invitation.toObject(),
      daysRemaining: invitation.daysRemaining,
      isExpired: invitation.isExpired,
    };

    return sendSuccess(res, enriched, "Invitation details retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve invitation details",
      null,
      500,
    );
  }
};

// ========== SEARCH ACTIVE PLANNERS (for inviting associates) ==========
exports.searchActivePlanners = async (req, res) => {
  try {
    const { search = "", region, language, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      role: "planner",
      active: true,
      deletedAt: null,
      _id: { $ne: req.user.id },
    };

    if (search.trim()) {
      query.email = { $regex: search.trim(), $options: "i" };
    }
    if (region && region !== "") {
      query.region = region;
    }
    if (language && language !== "") {
      query.languagesSpoken = language;
    }

    const [planners, total] = await Promise.all([
      User.find(query)
        .select("email firstName lastName region languagesSpoken")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    return sendSuccess(
      res,
      {
        planners,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      "Active planners retrieved",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to fetch planners",
      null,
      500,
    );
  }
};
