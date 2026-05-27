const express = require("express");
const router = express.Router();
const plannerController = require("../controllers/plannerController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");

const optionalCitizenAuth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return next();
  return auth(["citizen"])(req, res, next);
};

// ==================== PLANNER REQUESTS (Citizen -> Planner) ====================
router.post(
  "/request",
  optionalCitizenAuth,
  limiters.plannerRequest,
  plannerController.requestPlanner,
);

router.post(
  "/training/complete",
  auth(["planner"]),
  plannerController.completeTraining,
);

router.get(
  "/requests/pending",
  auth(["admin"]),
  plannerController.listPendingRequests,
);

router.post(
  "/requests/:id/approve",
  auth(["admin"]),
  validateObjectId("id"),
  plannerController.approveRequest,
);

router.post(
  "/requests/:id/reject",
  auth(["admin"]),
  validateObjectId("id"),
  plannerController.rejectRequest,
);

router.get(
  "/search",
  auth(["planner", "admin"]),
  plannerController.searchPlannersByLanguage,
);

// ==================== ASSOCIATE MANAGEMENT (Policy Owner / Admin) ====================
router.post(
  "/policies/:policyId/associates",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  plannerController.addAssociate,
);

router.get(
  "/policies/:policyId/associates",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  plannerController.listAssociates,
);

router.patch(
  "/policies/:policyId/associates/:associateId",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  validateObjectId("associateId"),
  plannerController.updateAssociatePermissions,
);

router.delete(
  "/policies/:policyId/associates/:associateId",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  validateObjectId("associateId"),
  plannerController.revokeAssociate,
);

// ==================== INVITATION ACTIONS (Associate) ====================
router.post(
  "/associates/:associateId/accept",
  auth(["planner"]),
  validateObjectId("associateId"),
  plannerController.acceptAssociateInvitation,
);

router.post(
  "/associates/:associateId/reject",
  auth(["planner"]),
  validateObjectId("associateId"),
  plannerController.rejectAssociateInvitation,
);

router.delete(
  "/associates/:associateId",
  auth(["planner"]),
  validateObjectId("associateId"),
  plannerController.revokeSelfAsAssociate,
);

// ==================== ASSOCIATE VIEWS (Accepted & Pending) ====================
router.get(
  "/associates/policies",
  auth(["planner"]),
  plannerController.getMyAssociatePolicies,
);

// NEW: Get all pending invitations for the logged‑in planner
router.get(
  "/associates/invitations/pending",
  auth(["planner"]),
  plannerController.getPendingInvitations,
);

// NEW: Get details of a single pending invitation (to preview policy before accepting)
router.get(
  "/associates/invitations/:invitationId",
  auth(["planner"]),
  validateObjectId("invitationId"),
  plannerController.getInvitationDetails,
);
router.get(
  "/active",
  auth(["planner", "admin"]),
  plannerController.searchActivePlanners,
);

module.exports = router;
