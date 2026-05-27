const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");
const {
  hasAssociatePermission,
} = require("../middleware/permissionMiddleware");
const {
  hasCommentPermission,
} = require("../middleware/commentPermissionMiddleware");
// ==================== PLANNER MANAGEMENT ====================
router.get(
  "/planners",
  auth(["planner", "admin"]),
  adminController.listPlanners,
);
router.get(
  "/planners/:id",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.getPlannerById,
);
router.post("/planners", auth(["admin"]), adminController.createPlanner);
router.put(
  "/planners/:id",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.updatePlanner,
);
router.put(
  "/planners/:id/status",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.updatePlannerStatus,
);

// ==================== COMMENT MODERATION ====================
// AI low confidence comments (planners with permissions can access)
router.get(
  "/comments/pending",
  auth(["planner", "admin"]),
  adminController.getPendingComments,
);

// Reported comments (hidden)
router.get(
  "/comments/flagged",
  auth(["planner", "admin"]),
  adminController.getFlaggedComments,
);

// Manual override (sentiment/keywords) – admin only
router.put(
  "/comments/:id",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.updateComment,
);

// Retry single comment – admin only
router.post(
  "/comments/:id/retry",
  auth(["planner", "admin"]),
  hasCommentPermission("moderate_comments"),
  adminController.retryComment,
);
// Force retry single comment – admin only
router.post(
  "/comments/:id/force-retry",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.forceRetryComment,
);

// Bulk retry by IDs – admin only
router.post(
  "/comments/bulk/retry-by-ids",
  auth(["admin"]),
  limiters.bulkAdmin,
  adminController.bulkRetryCommentsByIds,
);

// Soft delete comment – admin only
router.delete(
  "/comments/:id",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.deleteComment,
);

// ==================== REPORT MANAGEMENT ====================
router.get(
  "/comments/:commentId/reports",
  auth(["admin"]),
  validateObjectId("commentId"),
  adminController.getCommentReports,
);
router.put(
  "/comments/:commentId/reports/:reportId",
  auth(["admin"]),
  validateObjectId("commentId"),
  adminController.resolveReport,
);

// ==================== APPEAL MANAGEMENT ====================
// Allow planners with moderate_comments permission
router.get("/appeals", auth(["planner", "admin"]), adminController.getAppeals);
router.post(
  "/appeals/:commentId/resolve",
  auth(["planner", "admin"]),
  validateObjectId("commentId"),
  adminController.resolveAppeal,
);

// ==================== CITIZEN MANAGEMENT ====================
router.get("/users/citizens", auth(["admin"]), adminController.listCitizens);
router.put(
  "/users/:id/status",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.updateCitizenStatus,
);

// ==================== DASHBOARD & REPORTS ====================
router.get(
  "/dashboard/stats",
  auth(["admin"]),
  reportController.getDashboardStats,
);
router.get("/trends", auth(["admin"]), reportController.getTrends);
router.get("/audit-logs", auth(["admin"]), reportController.getAuditLogs);
router.get(
  "/audit-logs/export",
  auth(["admin"]),
  reportController.exportAuditLogs,
);
router.get("/ai/health", auth(["admin"]), reportController.getAIHealth);

// ==================== MISC ADMIN ====================
router.post(
  "/users/:id/initiate-password-reset",
  auth(["admin"]),
  validateObjectId("id"),
  adminController.initiatePasswordReset,
);
router.get(
  "/emerging-topics",
  auth(["admin"]),
  adminController.getEmergingTopics,
);
router.get(
  "/planners/search",
  auth(["admin", "planner"]),
  adminController.searchPlanners,
);

module.exports = router;
