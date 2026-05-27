import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { policyApi } from "../api/policies";
import { adminApi } from "../api/admin";
import { analyticsApi } from "../api/analytics";
import { plannerApi } from "../api/plannerApi";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import { Tabs, TabPane } from "../components/Tabs";
import { MetricCard } from "../components/MetricCard";
import { formatAuditDetails } from "../utils/auditFormatter";
import {
  Activity,
  AlertTriangle,
  Bell,
  Users,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  History,
  Plus,
  XCircle,
  Save,
  Copy,
  CheckCircle,
  PenSquare,
} from "lucide-react";
import { formatDate, getErrorMessage, toIsoFromDateInput } from "../lib/format";
import { ETHIOPIAN_REGIONS } from "../constants/regions";

function ActionButton({
  children,
  icon: Icon,
  onClick,
  variant = "secondary",
  loading = false,
}) {
  const classes =
    variant === "primary"
      ? "bg-teal-700 text-white hover:bg-teal-800"
      : variant === "danger"
        ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold disabled:opacity-50 ${classes}`}
    >
      {loading ? (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        Icon && <Icon className="h-3 w-3" />
      )}
      {children}
    </button>
  );
}

const formatPermission = (perm) => {
  const map = {
    moderate_comments: "Moderate Comments",
    reply_official: "Official Replies",
    export_data: "Export Data",
  };
  return map[perm] || perm;
};

export function PolicyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [policy, setPolicy] = useState(null);
  const [selectedTab, setSelectedTab] = useState("info");
  const [stats, setStats] = useState(null);
  const [allComments, setAllComments] = useState([]);
  const [pendingComments, setPendingComments] = useState([]);
  const [reportedComments, setReportedComments] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [allPlanners, setAllPlanners] = useState([]);
  const [loadingPlanners, setLoadingPlanners] = useState(false);
  const [plannerSearch, setPlannerSearch] = useState("");
  const [plannerRegion, setPlannerRegion] = useState("");
  const [plannerLanguage, setPlannerLanguage] = useState("");
  const [plannerPage, setPlannerPage] = useState(1);
  const [plannerTotalPages, setPlannerTotalPages] = useState(1);
  const [plannerTotal, setPlannerTotal] = useState(0);
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [selectedAssociate, setSelectedAssociate] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [modalError, setModalError] = useState("");
  const [overrideComment, setOverrideComment] = useState(null);
  const [overrideSentiment, setOverrideSentiment] = useState("");
  const [overrideKeywords, setOverrideKeywords] = useState("");
  const [editingAssociate, setEditingAssociate] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [reportsModal, setReportsModal] = useState({
    open: false,
    reports: [],
  });
  const [appealModal, setAppealModal] = useState({
    open: false,
    comment: null,
    decision: "",
  });
  const [commentErrors, setCommentErrors] = useState({}); // for per-comment errors
  const fetchPlanners = async () => {
    setLoadingPlanners(true);
    try {
      const params = {
        page: plannerPage,
        limit: 10,
        search: plannerSearch,
        region: plannerRegion,
        language: plannerLanguage,
      };
      const result = await plannerApi.searchActivePlanners(params);
      setAllPlanners(result.planners || []);
      setPlannerTotalPages(result.totalPages || 1);
      setPlannerTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch planners", err);
      setAllPlanners([]);
    } finally {
      setLoadingPlanners(false);
    }
  };

  useEffect(() => {
    if (showAssociateModal) fetchPlanners();
  }, [
    showAssociateModal,
    plannerPage,
    plannerSearch,
    plannerRegion,
    plannerLanguage,
  ]);

  useEffect(() => {
    if (showAssociateModal) setPlannerPage(1);
  }, [plannerSearch, plannerRegion, plannerLanguage]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        policyData,
        analytics,
        all,
        pending,
        reported,
        appealsData,
        associatesData,
        history,
      ] = await Promise.all([
        policyApi.get(id),
        analyticsApi.summary(id),
        analyticsApi.comments(id, { limit: 100 }),
        adminApi.getAIReviewComments({ policyId: id }),
        adminApi.getReportedComments({ policyId: id }),
        adminApi.getPendingAppeals({ policyId: id }),
        plannerApi.listAssociates(id).catch(() => []),
        policyApi.history(id).catch(() => ({ events: [] })),
      ]);
      setPolicy(policyData);
      setStats(analytics);
      setAllComments(all.comments || []);
      setPendingComments(pending.comments || []);
      setReportedComments(reported.comments || []);
      setAppeals(
        Array.isArray(appealsData) ? appealsData : appealsData.appeals || [],
      );
      setAssociates(associatesData);
      setHistoryEvents(history.events || []);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, "Failed to load policy data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  // Redirect draft policies to edit page
  useEffect(() => {
    if (policy && policy.status === "draft") {
      navigate(`/policies/${id}/edit`);
    }
  }, [policy, id, navigate]);

  const runAction = async (
    key,
    action,
    successMsg,
    options = { suppressNotice: false },
  ) => {
    setActionLoading(key);
    setError("");
    if (!options.suppressNotice) setNotice("");
    try {
      await action();
      if (!options.suppressNotice && successMsg) setNotice(successMsg);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Action failed"));
    } finally {
      setActionLoading("");
    }
  };

  const handleExtend = async () => {
    const newEnd = window.prompt("New end date (YYYY-MM-DD):", "");
    if (!newEnd) return;
    await runAction(
      "extend",
      () => policyApi.extend(id, toIsoFromDateInput(newEnd, true)),
      "End date extended.",
    );
  };

  const sendInvitation = async () => {
    if (!selectedAssociate) return;
    setActionLoading("associateAdd");
    setModalError("");
    try {
      await plannerApi.addAssociate(id, {
        plannerEmail: selectedAssociate.email,
        permissions: selectedPermissions,
      });
      setShowAssociateModal(false);
      setSelectedAssociate(null);
      setSelectedPermissions([]);
      await loadData();
    } catch (err) {
      setModalError(getErrorMessage(err, "Failed to send invitation"));
    } finally {
      setActionLoading("");
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideComment) return;
    const sentimentLabel =
      overrideSentiment === "positive"
        ? "positive"
        : overrideSentiment === "negative"
          ? "negative"
          : "neutral";
    await runAction(
      `override-${overrideComment._id}`,
      () =>
        adminApi.updateComment(overrideComment._id, {
          sentiment: {
            label: sentimentLabel,
            confidence: 1,
            overriddenByModerator: true,
          },
          keywords: overrideKeywords.split(",").map((k) => k.trim()),
        }),
      "Sentiment and keywords overridden.",
    );
    setOverrideComment(null);
    setOverrideSentiment("");
    setOverrideKeywords("");
  };
  const viewReports = async (commentId) => {
    setActionLoading(`reports-${commentId}`);
    try {
      const result = await adminApi.getCommentReports(commentId);
      setReportsModal({ open: true, reports: result.reports || [] });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load reports"));
    } finally {
      setActionLoading("");
    }
  };

  const viewHistory = async (commentId) => {
    setActionLoading(`history-${commentId}`);
    try {
      const versions = await commentApi.getVersions(commentId);
      setHistoryEvents(versions || []); // assuming you have historyEvents state for modal
      setHistoryPolicy({ id: commentId }); // to trigger history modal (you already have historyPolicy)
      setShowHistoryModal(true);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load comment history"));
    } finally {
      setActionLoading("");
    }
  };

  const resolveAppeal = async (comment, decision) => {
    setActionLoading(`appeal-${comment._id}`);
    try {
      await adminApi.resolveAppeal(comment._id, decision);
      setAppealModal({ open: false, comment: null, decision: "" });
      await loadData(); // refresh all data
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${decision} appeal`));
    } finally {
      setActionLoading("");
    }
  };

  const retryComment = async (commentId) => {
    setActionLoading(`retry-${commentId}`);
    setCommentErrors((prev) => ({ ...prev, [commentId]: null }));
    try {
      await adminApi.retryComment(commentId);
      // Optionally refresh after delay (you can just refresh after 2 seconds)
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      setCommentErrors((prev) => ({
        ...prev,
        [commentId]: getErrorMessage(err),
      }));
    } finally {
      setActionLoading("");
    }
  };
  const renderCommentsList = (comments, actions = []) => (
    <div className="space-y-3">
      {comments.map((c) => {
        const commentId = c._id || c.id;
        const text = c.text || c.comment;
        const userDisplayName =
          c.userId?.displayName || c.userDisplayName || "Anonymous";
        const createdAt = c.createdAt;
        const sentimentLabel =
          typeof c.sentiment === "string"
            ? c.sentiment
            : c.sentiment?.label || null;
        return (
          <div key={commentId} className="rounded-lg border p-3">
            <p className="text-sm font-semibold">{text}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{userDisplayName}</span>
              <span>•</span>
              <span>{formatDate(createdAt)}</span>
              {sentimentLabel && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  Sentiment: {sentimentLabel}
                </span>
              )}
              {c.reportCount !== undefined && (
                <span className="text-rose-600">Reports: {c.reportCount}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {actions.map((act) => (
                <ActionButton
                  key={act.label}
                  icon={act.icon}
                  onClick={() => act.onClick(c)}
                  loading={actionLoading === `${act.label}-${commentId}`}
                >
                  {act.label}
                </ActionButton>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
  if (loading) return <LoadingState label="Loading policy details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!policy) return <div>Policy not found</div>;

  const mainTabs = [
    { id: "info", label: "Policy Info" },
    { id: "comments", label: `Comments (${allComments.length})` },
    { id: "associates", label: "Associates" },
  ];

  const commentsSubTabs = [
    { id: "all", label: "All" },
    { id: "ai", label: `AI Needs Review (${pendingComments.length})` },
    { id: "reported", label: `Reported (${reportedComments.length})` },
    { id: "appeals", label: `Appeals (${appeals.length})` },
  ];

  return (
    <div>
      <PageHeader
        title={policy.title}
        description={`Policy Code: ${policy.policyCode} • Created by ${policy.createdBy?.email || "Unknown"}`}
        actions={
          <div className="flex gap-2">
            <Link
              to="/policies"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              ← Back to Policies
            </Link>
            <ActionButton
              icon={History}
              onClick={() => setShowHistoryModal(true)}
            >
              History
            </ActionButton>
          </div>
        }
      />
      {notice && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      )}
      <ErrorAlert message={error} />

      {/* Stats row */}
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Votes"
          value={stats?.totalVotes || 0}
          icon={Activity}
        />
        <MetricCard
          label="Pending AI Review"
          value={pendingComments.length}
          icon={Bell}
        />
        <MetricCard
          label="Reported"
          value={reportedComments.length}
          icon={AlertTriangle}
        />
        <MetricCard label="Appeals" value={appeals.length} icon={Users} />
      </div>

      <Tabs
        tabs={mainTabs}
        activeTab={selectedTab}
        onTabChange={setSelectedTab}
      >
        <TabPane tabId="info">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2 mb-4">
              {policy.status === "published" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction(
                      "unpublish",
                      () => policyApi.unpublish(id),
                      "Unpublished.",
                    )
                  }
                >
                  Unpublish
                </ActionButton>
              )}
              {policy.status === "active" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction("pause", () => policyApi.pause(id), "Paused.")
                  }
                >
                  Pause
                </ActionButton>
              )}
              {policy.status === "paused" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction("resume", () => policyApi.resume(id), "Resumed.")
                  }
                >
                  Resume
                </ActionButton>
              )}
              {["active", "paused"].includes(policy.status) && (
                <>
                  <ActionButton icon={RefreshCw} onClick={handleExtend}>
                    Extend
                  </ActionButton>
                  <ActionButton
                    icon={RefreshCw}
                    onClick={() =>
                      runAction("close", () => policyApi.close(id), "Closed.")
                    }
                  >
                    Close
                  </ActionButton>
                </>
              )}
              {policy.status !== "archived" && policy.status !== "draft" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction(
                      "archive",
                      () => policyApi.archive(id),
                      "Archived.",
                    )
                  }
                >
                  Archive
                </ActionButton>
              )}
              {policy.status === "archived" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction(
                      "restore",
                      () => policyApi.restore(id),
                      "Restored to draft.",
                    )
                  }
                >
                  Restore
                </ActionButton>
              )}
              {["published"].includes(policy.status) && (
                <ActionButton
                  icon={Trash2}
                  variant="danger"
                  onClick={() =>
                    runAction("delete", () => policyApi.delete(id), "Deleted.")
                  }
                >
                  Delete
                </ActionButton>
              )}
              <ActionButton
                icon={Eye}
                onClick={() =>
                  window.open(`/policies/${id}/analytics`, "_blank")
                }
              >
                Full Analytics
              </ActionButton>
              <ActionButton
                icon={Copy}
                onClick={async () => {
                  setActionLoading("clone");
                  try {
                    const result = await policyApi.clone(id);
                    setNotice(
                      `Policy cloned as a new draft. Redirecting to edit...`,
                    );
                    navigate(`/policies/${result.id}/edit`);
                  } catch (err) {
                    setError(getErrorMessage(err, "Failed to clone policy"));
                  } finally {
                    setActionLoading("");
                  }
                }}
                loading={actionLoading === "clone"}
              >
                Clone
              </ActionButton>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              <dt className="font-semibold">Status:</dt>
              <dd>
                <StatusBadge status={policy.status} />
              </dd>
              <dt className="font-semibold">Target Regions:</dt>
              <dd>{policy.targetRegions?.join(", ") || "None"}</dd>
              <dt className="font-semibold">Start Date:</dt>
              <dd>{formatDate(policy.startDate)}</dd>
              <dt className="font-semibold">End Date:</dt>
              <dd>{formatDate(policy.endDate)}</dd>
              <dt className="font-semibold">Poll Type:</dt>
              <dd>{policy.pollType}</dd>
              <dt className="font-semibold">Topics:</dt>
              <dd>{policy.topics?.join(", ") || "None"}</dd>
              <dt className="font-semibold">Sentiment Counts:</dt>
              <dd>
                Pos: {stats?.sentimentCounts?.positive || 0} | Neg:{" "}
                {stats?.sentimentCounts?.negative || 0} | Neu:{" "}
                {stats?.sentimentCounts?.neutral || 0}
              </dd>
              <dt className="font-semibold">Top Keywords:</dt>
              <dd>
                {stats?.topKeywords
                  ?.slice(0, 5)
                  .map((k) => k.keyword)
                  .join(", ") || "None"}
              </dd>
            </dl>
          </div>
        </TabPane>

        <TabPane tabId="comments">
          <Tabs tabs={commentsSubTabs} defaultTab="all">
            {/* All comments tab: keep as is (list with delete only) */}
            <TabPane tabId="all">
              {renderCommentsList(allComments, [
                {
                  label: "Delete",
                  icon: Trash2,
                  onClick: (c) =>
                    runAction(
                      `delete-${c.id}`,
                      () => adminApi.deleteComment(c.id),
                      "Comment deleted.",
                    ),
                },
              ])}
            </TabPane>

            {/* AI Needs Review tab - same as CommentModerationPage's AI tab */}
            <TabPane tabId="ai">
              {pendingComments.map((comment) => {
                const isProcessing =
                  comment.aiStatus === "pending" &&
                  comment.lastAnalyzedAt != null;
                const isLoading =
                  actionLoading === `retry-${comment._id}` ||
                  actionLoading === `override-${comment._id}`;
                const localError = commentErrors[comment._id];
                const sentimentLabel = comment.sentiment?.label;
                const reviewNeeded = comment.reviewFlags?.sentimentReviewNeeded;
                return (
                  <div
                    key={comment._id}
                    className="rounded-lg border border-slate-200 bg-white p-4 mb-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="text-sm text-slate-500">
                          Comment by{" "}
                          <span className="font-semibold text-slate-900">
                            {comment.userId?.email || "Unknown"}
                          </span>{" "}
                          • {formatDate(comment.createdAt)}
                          {comment.versionNumber > 1 && (
                            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">
                              v{comment.versionNumber}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {sentimentLabel && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                              sentimentLabel === "positive"
                                ? "bg-emerald-100 text-emerald-700"
                                : sentimentLabel === "negative"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {sentimentLabel}
                          </span>
                        )}
                        {reviewNeeded && !isProcessing && !isLoading && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                            Low confidence
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />{" "}
                            AI pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mb-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-900">{comment.text}</p>
                    </div>
                    {comment.keywords?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-600 mb-1">
                          Keywords:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {comment.keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {localError && (
                      <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                        {localError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                      <button
                        onClick={() =>
                          runAction(
                            `approve-${comment._id}`,
                            () =>
                              commentApi.moderate(comment._id, {
                                action: "approve",
                              }),
                            "Comment approved.",
                          )
                        }
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setOverrideComment(comment);
                          setOverrideSentiment(sentimentLabel || "neutral");
                          setOverrideKeywords(
                            (comment.keywords || []).join(", "),
                          );
                        }}
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <PenSquare className="h-3.5 w-3.5" /> Override
                      </button>
                      <button
                        onClick={() => retryComment(comment._id)}
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry AI
                      </button>
                      <button
                        onClick={() =>
                          runAction(
                            `delete-${comment._id}`,
                            () => adminApi.deleteComment(comment._id),
                            "Comment deleted.",
                          )
                        }
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </TabPane>

            {/* Reported Comments tab */}
            <TabPane tabId="reported">
              {reportedComments.map((comment) => (
                <div
                  key={comment._id}
                  className="rounded-lg border border-slate-200 bg-white p-4 mb-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">
                        Comment by{" "}
                        <span className="font-semibold text-slate-900">
                          {comment.userId?.email || "Unknown"}
                        </span>{" "}
                        • {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-900">{comment.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={() =>
                        runAction(
                          `restore-${comment._id}`,
                          () =>
                            commentApi.moderate(comment._id, {
                              action: "approve",
                            }),
                          "Comment restored.",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve (Restore)
                    </button>
                    <button
                      onClick={() =>
                        runAction(
                          `delete-${comment._id}`,
                          () => adminApi.deleteComment(comment._id),
                          "Comment deleted.",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                    <button
                      onClick={() => viewReports(comment._id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" /> View reports
                    </button>
                  </div>
                </div>
              ))}
            </TabPane>

            {/* Appeals tab */}
            <TabPane tabId="appeals">
              {appeals.map((item) => {
                const comment = item.comment || item;
                return (
                  <div
                    key={comment._id}
                    className="rounded-lg border border-slate-200 bg-white p-4 mb-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="text-sm text-slate-500">
                          Comment by{" "}
                          <span className="font-semibold text-slate-900">
                            {comment.userId?.email || "Unknown"}
                          </span>{" "}
                          • {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mb-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-900">{comment.text}</p>
                    </div>
                    {comment.appeal && (
                      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-700">
                          Appeal reason:
                        </p>
                        <p className="text-sm text-blue-800">
                          {comment.appeal.reason}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() =>
                              setAppealModal({
                                open: true,
                                comment,
                                decision: "approve",
                              })
                            }
                            className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                          >
                            Approve appeal
                          </button>
                          <button
                            onClick={() =>
                              setAppealModal({
                                open: true,
                                comment,
                                decision: "reject",
                              })
                            }
                            className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-bold text-white hover:bg-rose-800"
                          >
                            Reject appeal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </TabPane>
          </Tabs>
        </TabPane>

        <TabPane tabId="associates">
          <div className="rounded-lg border bg-white p-5">
            <div className="mb-4 flex justify-between">
              <h3 className="text-lg font-bold">Associates & Invitations</h3>
              {["published", "active", "paused", "closed"].includes(
                policy.status,
              ) && (
                <ActionButton
                  icon={Plus}
                  onClick={() => {
                    setModalError("");
                    setShowAssociateModal(true);
                  }}
                >
                  Invite Associate
                </ActionButton>
              )}
            </div>

            {/* Current Associates */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-slate-700 mb-2">
                Current
              </h4>
              {associates.filter(
                (a) =>
                  a.displayStatus === "pending" ||
                  a.displayStatus === "accepted",
              ).length === 0 ? (
                <p className="text-slate-500">
                  No active associates or pending invitations.
                </p>
              ) : (
                <div className="divide-y">
                  {associates
                    .filter(
                      (a) =>
                        a.displayStatus === "pending" ||
                        a.displayStatus === "accepted",
                    )
                    .map((assoc) => {
                      const isPending = assoc.displayStatus === "pending";
                      const isAccepted = assoc.displayStatus === "accepted";
                      return (
                        <div
                          key={assoc._id}
                          className="py-4 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">
                              {assoc.plannerId?.email}
                              {isPending && (
                                <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                  Pending
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              Permissions:{" "}
                              {assoc.permissions
                                ?.map(formatPermission)
                                .join(", ") || "None"}
                            </p>
                            {isPending && assoc.daysRemaining !== null && (
                              <p className="text-xs text-amber-600">
                                Expires in {assoc.daysRemaining} days
                              </p>
                            )}
                            {isAccepted && (
                              <p className="text-xs text-slate-500">
                                Accepted: {formatDate(assoc.acceptedAt)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {isAccepted && (
                              <ActionButton
                                icon={Edit}
                                onClick={() => {
                                  setEditingAssociate(assoc);
                                  setEditPermissions(assoc.permissions || []);
                                }}
                              >
                                Edit Permissions
                              </ActionButton>
                            )}
                            {(isPending || isAccepted) && (
                              <ActionButton
                                icon={Trash2}
                                variant="danger"
                                onClick={() =>
                                  runAction(
                                    `revoke-${assoc._id}`,
                                    () =>
                                      plannerApi.revokeAssociate(id, assoc._id),
                                    isPending
                                      ? "Invitation cancelled."
                                      : "Associate revoked.",
                                    { suppressNotice: true },
                                  )
                                }
                              >
                                {isPending ? "Cancel Invitation" : "Revoke"}
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Past Associates */}
            <div>
              <h4 className="text-md font-semibold text-slate-700 mb-2">
                Past
              </h4>
              {associates.filter(
                (a) =>
                  a.displayStatus === "revoked" ||
                  a.displayStatus === "expired",
              ).length === 0 ? (
                <p className="text-slate-500">
                  No past associates or expired invitations.
                </p>
              ) : (
                <div className="divide-y">
                  {associates
                    .filter(
                      (a) =>
                        a.displayStatus === "revoked" ||
                        a.displayStatus === "expired",
                    )
                    .map((assoc) => (
                      <div
                        key={assoc._id}
                        className="py-4 flex justify-between items-center opacity-70"
                      >
                        <div>
                          <p className="font-semibold">
                            {assoc.plannerId?.email}
                            <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              {assoc.displayStatus === "revoked"
                                ? "Revoked"
                                : "Expired"}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            Permissions:{" "}
                            {assoc.permissions
                              ?.map(formatPermission)
                              .join(", ") || "None"}
                          </p>
                          {assoc.revokedAt && (
                            <p className="text-xs text-slate-500">
                              {assoc.displayStatus === "revoked"
                                ? "Revoked"
                                : "Expired"}
                              : {formatDate(assoc.revokedAt || assoc.expiresAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </TabPane>
      </Tabs>
      {/* History Modal */}
      {showHistoryModal && (
        <Modal
          title={`Policy History: ${policy.title}`}
          onClose={() => setShowHistoryModal(false)}
        >
          {historyEvents.length === 0 ? (
            <p>No history events.</p>
          ) : (
            <ol className="space-y-2">
              {historyEvents.map((ev, i) => (
                <li key={i} className="border-b pb-2">
                  <p className="font-semibold">{ev.action}</p>
                  <p className="text-xs text-slate-500">
                    {ev.userRole} • {formatDate(ev.timestamp)}
                  </p>
                  {ev.details && (
                    <div className="mt-1 text-xs text-slate-600">
                      {formatAuditDetails(ev)}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
      {/* Override Sentiment Modal */}
      {overrideComment && (
        <Modal
          title="Override Sentiment"
          onClose={() => setOverrideComment(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Original: {overrideComment.text}
            </p>
            <div>
              <label className="block text-sm font-semibold">Sentiment</label>
              <select
                value={overrideSentiment}
                onChange={(e) => setOverrideSentiment(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="">Select sentiment</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <ActionButton
              icon={Save}
              onClick={() => {
                const sentimentLabel =
                  overrideSentiment === "positive"
                    ? "positive"
                    : overrideSentiment === "negative"
                      ? "negative"
                      : "neutral";
                runAction(
                  `override-${overrideComment._id}`,
                  () =>
                    commentApi.moderate(overrideComment._id, {
                      action: "approve",
                      sentiment: { label: sentimentLabel, confidence: 1 },
                    }),
                  "Sentiment overridden.",
                );
                setOverrideComment(null);
                setOverrideSentiment("");
              }}
              disabled={!overrideSentiment}
            >
              Save Override
            </ActionButton>
          </div>
        </Modal>
      )}
      {/* Invite Associate Modal */}
      {showAssociateModal && (
        <Modal
          title="Invite Associate"
          onClose={
            actionLoading === "associateAdd"
              ? undefined
              : () => setShowAssociateModal(false)
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Search by email"
                value={plannerSearch}
                onChange={(e) => setPlannerSearch(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={plannerRegion}
                onChange={(e) => setPlannerRegion(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All regions</option>
                {ETHIOPIAN_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={plannerLanguage}
                onChange={(e) => setPlannerLanguage(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All languages</option>
                <option value="am">Amharic</option>
                <option value="om">Oromo</option>
                <option value="ti">Tigrinya</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {loadingPlanners ? (
                <p className="p-4 text-center text-slate-500">
                  Loading planners...
                </p>
              ) : allPlanners.length === 0 ? (
                <p className="p-4 text-center text-slate-500">
                  No planners found.
                </p>
              ) : (
                allPlanners.map((planner) => {
                  const isAlreadyAssociate = associates.some(
                    (a) => a.plannerId?._id === planner._id && !a.revokedAt,
                  );
                  if (isAlreadyAssociate) return null;
                  return (
                    <div
                      key={planner._id}
                      className={`p-3 flex justify-between items-center hover:bg-slate-50 cursor-pointer ${selectedAssociate?._id === planner._id ? "bg-teal-50 border-teal-200" : ""}`}
                      onClick={() => {
                        setSelectedAssociate(planner);
                        setSelectedPermissions([]);
                      }}
                    >
                      <div>
                        <p className="font-semibold text-sm">{planner.email}</p>
                        <p className="text-xs text-slate-500">
                          {planner.languagesSpoken?.join(", ") ||
                            "No languages"}{" "}
                          • {planner.region || "No region"}
                        </p>
                      </div>
                      {selectedAssociate?._id === planner._id && (
                        <span className="text-xs font-bold text-teal-700 bg-teal-100 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {!loadingPlanners && allPlanners.length > 0 && (
              <div className="flex justify-between items-center mt-2">
                <button
                  disabled={plannerPage <= 1}
                  onClick={() => setPlannerPage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 text-xs"
                >
                  Previous
                </button>
                <span className="text-xs">
                  Page {plannerPage} of {plannerTotalPages} ({plannerTotal}{" "}
                  total)
                </span>
                <button
                  disabled={plannerPage >= plannerTotalPages}
                  onClick={() => setPlannerPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 text-xs"
                >
                  Next
                </button>
              </div>
            )}
            {selectedAssociate && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-sm font-semibold">
                  Permissions for{" "}
                  <span className="text-teal-700">
                    {selectedAssociate.email}
                  </span>
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value="moderate_comments"
                      checked={selectedPermissions.includes(
                        "moderate_comments",
                      )}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedPermissions([
                            ...selectedPermissions,
                            e.target.value,
                          ]);
                        else
                          setSelectedPermissions(
                            selectedPermissions.filter(
                              (p) => p !== e.target.value,
                            ),
                          );
                      }}
                    />
                    Moderate Comments
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value="reply_official"
                      checked={selectedPermissions.includes("reply_official")}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedPermissions([
                            ...selectedPermissions,
                            e.target.value,
                          ]);
                        else
                          setSelectedPermissions(
                            selectedPermissions.filter(
                              (p) => p !== e.target.value,
                            ),
                          );
                      }}
                    />
                    Official Replies
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value="export_data"
                      checked={selectedPermissions.includes("export_data")}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedPermissions([
                            ...selectedPermissions,
                            e.target.value,
                          ]);
                        else
                          setSelectedPermissions(
                            selectedPermissions.filter(
                              (p) => p !== e.target.value,
                            ),
                          );
                      }}
                    />
                    Export Data
                  </label>
                </div>
                {modalError && <ErrorAlert message={modalError} />}
                <ActionButton
                  onClick={sendInvitation}
                  disabled={
                    selectedPermissions.length === 0 ||
                    actionLoading === "associateAdd"
                  }
                  loading={actionLoading === "associateAdd"}
                >
                  Send Invitation
                </ActionButton>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Associate Permissions Modal */}
      {editingAssociate && (
        <Modal
          title="Edit Associate Permissions"
          onClose={() => setEditingAssociate(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Editing permissions for{" "}
              <strong>{editingAssociate.plannerId?.email}</strong>
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value="moderate_comments"
                  checked={editPermissions.includes("moderate_comments")}
                  onChange={(e) => {
                    if (e.target.checked)
                      setEditPermissions([
                        ...editPermissions,
                        "moderate_comments",
                      ]);
                    else
                      setEditPermissions(
                        editPermissions.filter(
                          (p) => p !== "moderate_comments",
                        ),
                      );
                  }}
                />
                Moderate Comments
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value="reply_official"
                  checked={editPermissions.includes("reply_official")}
                  onChange={(e) => {
                    if (e.target.checked)
                      setEditPermissions([
                        ...editPermissions,
                        "reply_official",
                      ]);
                    else
                      setEditPermissions(
                        editPermissions.filter((p) => p !== "reply_official"),
                      );
                  }}
                />
                Official Replies
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value="export_data"
                  checked={editPermissions.includes("export_data")}
                  onChange={(e) => {
                    if (e.target.checked)
                      setEditPermissions([...editPermissions, "export_data"]);
                    else
                      setEditPermissions(
                        editPermissions.filter((p) => p !== "export_data"),
                      );
                  }}
                />
                Export Data
              </label>
            </div>
            <ActionButton
              icon={Save}
              onClick={async () => {
                await runAction(
                  `edit-perms-${editingAssociate._id}`,
                  () =>
                    plannerApi.updateAssociatePermissions(
                      id,
                      editingAssociate._id,
                      editPermissions,
                    ),
                  "Permissions updated.",
                );
                setEditingAssociate(null);
              }}
            >
              Save Changes
            </ActionButton>
          </div>
        </Modal>
      )}

      {/* Reports modal */}
      {reportsModal.open && (
        <Modal
          title="Comment Reports"
          onClose={() => setReportsModal({ open: false, reports: [] })}
        >
          {reportsModal.reports.length === 0 ? (
            <p className="text-sm text-slate-600">No reports found.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reportsModal.reports.map((report, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-xs font-semibold text-slate-600">
                    Reported by: {report.reportedBy?.email || "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Reason: {report.reason}
                  </p>
                  {report.details && (
                    <p className="text-xs text-slate-500">
                      Details: {report.details}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Status: {report.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created: {formatDate(report.createdAt)}
                  </p>
                  {report.resolvedAt && (
                    <p className="text-xs text-slate-500">
                      Resolved: {formatDate(report.resolvedAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Appeal resolution modal */}
      {appealModal.open && appealModal.comment && (
        <Modal
          title="Resolve Appeal"
          onClose={() =>
            setAppealModal({ open: false, comment: null, decision: "" })
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">
                Comment text:
              </p>
              <p className="text-sm text-slate-900">
                {appealModal.comment.text}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-900">
                Appeal reason:
              </p>
              <p className="text-sm text-blue-800">
                {appealModal.comment.appeal?.reason}
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() =>
                  setAppealModal({ open: false, comment: null, decision: "" })
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resolveAppeal(appealModal.comment, "approve")}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Overturn (approve comment)
              </button>
              <button
                onClick={() => resolveAppeal(appealModal.comment, "reject")}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
              >
                Reject appeal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
