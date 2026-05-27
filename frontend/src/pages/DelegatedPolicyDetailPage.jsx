import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { policyApi } from "../api/policies";
import { plannerApi } from "../api/plannerApi";
import { commentApi } from "../api/comments";
import { analyticsApi } from "../api/analytics";
import { adminApi } from "../api/admin";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { StatusBadge } from "../components/StatusBadge";
import { Tabs, TabPane } from "../components/Tabs";
import { formatDate, getErrorMessage } from "../lib/format";
import {
  BarChart3,
  LogOut,
  Trash2,
  Eye,
  Reply,
  XCircle,
  Download,
  AlertCircle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

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
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </button>
  );
}

export function DelegatedPolicyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [associateId, setAssociateId] = useState(null);
  const [comments, setComments] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [commentErrors, setCommentErrors] = useState({});

  // Load policy and permissions
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const policyData = await policyApi.get(id);
        setPolicy(policyData);

        const delegated = await plannerApi.getMyAssociatePolicies();
        const match = delegated.find((d) => d.policy._id === id);
        if (match) {
          setPermissions(match.permissions);
          setAssociateId(match.associateId);
        } else {
          const permRes = await policyApi.getAssociatePermissions(id);
          setPermissions(permRes.permissions || []);
        }
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load policy"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Load comments if user has comment permissions AND policy is active/paused/closed
  useEffect(() => {
    async function loadComments() {
      if (!policy) return;
      const isActive = ["active", "paused", "closed"].includes(policy.status);
      if (permissions.includes("moderate_comments") && isActive) {
        try {
          const commentsRes = await commentApi.getPolicyComments(id, {
            limit: 100,
          });
          // Enrich with display name
          const enriched = (commentsRes.comments || []).map((c) => ({
            ...c,
            userDisplayName: c.user?.displayName || "Anonymous",
          }));
          setComments(enriched);
        } catch (err) {
          console.error("Failed to load comments", err);
        }
      } else {
        setComments([]);
      }
    }
    loadComments();
  }, [id, policy, permissions]);

  const handleSelfRevoke = async () => {
    if (!associateId) return;
    if (
      !window.confirm(
        "Are you sure you want to leave this policy? You will lose all access.",
      )
    )
      return;
    try {
      await plannerApi.removeSelfAsAssociate(associateId);
      alert("You have been removed as an associate.");
      navigate("/associates/policies");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to revoke"));
    }
  };

  const moderateComment = async (
    commentId,
    action,
    reason = "",
    override = {},
  ) => {
    setActionLoading(`${action}-${commentId}`);
    setCommentErrors((prev) => ({ ...prev, [commentId]: null }));
    try {
      await commentApi.moderate(commentId, { action, ...override });
      // Refresh comments
      const commentsRes = await commentApi.getPolicyComments(id, {
        limit: 100,
      });
      const enriched = (commentsRes.comments || []).map((c) => ({
        ...c,
        userDisplayName: c.user?.displayName || "Anonymous",
      }));
      setComments(enriched);
    } catch (err) {
      setCommentErrors((prev) => ({
        ...prev,
        [commentId]: getErrorMessage(err, "Moderation failed"),
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const retryComment = async (commentId) => {
    setActionLoading(`retry-${commentId}`);
    setCommentErrors((prev) => ({ ...prev, [commentId]: null }));
    try {
      await adminApi.retryComment(commentId);
      // Refresh comments after a delay to allow AI processing
      setTimeout(async () => {
        const commentsRes = await commentApi.getPolicyComments(id, {
          limit: 100,
        });
        const enriched = (commentsRes.comments || []).map((c) => ({
          ...c,
          userDisplayName: c.user?.displayName || "Anonymous",
        }));
        setComments(enriched);
      }, 2000);
    } catch (err) {
      setCommentErrors((prev) => ({
        ...prev,
        [commentId]: getErrorMessage(err, "Failed to retry AI"),
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const replyOfficial = async (commentId) => {
    const replyText = window.prompt("Enter your official reply:", "");
    if (!replyText) return;
    setActionLoading(`reply-${commentId}`);
    try {
      await commentApi.replyOfficial(commentId, replyText);
      const commentsRes = await commentApi.getPolicyComments(id, {
        limit: 100,
      });
      const enriched = (commentsRes.comments || []).map((c) => ({
        ...c,
        userDisplayName: c.user?.displayName || "Anonymous",
      }));
      setComments(enriched);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to post reply"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await analyticsApi.exportCsv(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `policy-${policy.policyCode}-export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to export data"));
    }
  };

  if (loading) return <LoadingState label="Loading policy details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!policy) return <div>Policy not found</div>;

  const isActive = ["active", "paused", "closed"].includes(policy.status);
  const canModerate = permissions.includes("moderate_comments") && isActive;
  const canReplyOfficial = permissions.includes("reply_official") && isActive;
  const canExport = permissions.includes("export_data") && isActive;
  const canViewAnalytics = isActive; // any planner can view analytics for active/paused/closed

  const tabs = [{ id: "info", label: "Policy Info" }];
  if (canModerate || canReplyOfficial) {
    tabs.push({ id: "comments", label: "Comments" });
  }

  return (
    <div>
      <PageHeader
        title={policy.title}
        description={`Policy Code: ${policy.policyCode} • You are an associate`}
        actions={
          <div className="flex gap-2">
            {canViewAnalytics && (
              <button
                onClick={() => navigate(`/policies/${id}/analytics`)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
              >
                <BarChart3 className="h-4 w-4" />
                View Analytics
              </button>
            )}
            {canExport && canViewAnalytics && (
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            )}
            <button
              onClick={handleSelfRevoke}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Leave Policy
            </button>
          </div>
        }
      />
      <ErrorAlert message={error} />

      {/* Info banner for non‑active policies */}
      {!isActive && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Policy not yet active</p>
              <p className="text-sm">
                This policy is currently {policy.status}. Analytics, comment
                moderation, and export will be available once the policy becomes
                active.
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={tabs} defaultTab="info">
        <TabPane tabId="info">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
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
              <dt className="font-semibold">Your Permissions:</dt>
              <dd>
                {permissions
                  .map((p) =>
                    p === "moderate_comments"
                      ? "Moderate Comments"
                      : p === "reply_official"
                        ? "Official Replies"
                        : "Export Data",
                  )
                  .join(", ") || "None"}
              </dd>
            </dl>
          </div>
        </TabPane>

        {(canModerate || canReplyOfficial) && (
          <TabPane tabId="comments">
            <div className="rounded-lg border bg-white p-5">
              <h3 className="text-lg font-bold mb-4">Comments</h3>
              {comments.length === 0 ? (
                <p className="text-slate-500">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3">
                      <p className="text-sm font-semibold">{c.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{c.userDisplayName}</span>
                        <span>•</span>
                        <span>{formatDate(c.createdAt)}</span>
                        {c.sentiment && (
                          <span
                            className={`rounded-full px-2 py-0.5 ${
                              c.sentiment === "positive"
                                ? "bg-emerald-100 text-emerald-700"
                                : c.sentiment === "negative"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {c.sentiment}
                          </span>
                        )}
                      </div>
                      {c.keywords?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.keywords.map((kw) => (
                            <span
                              key={kw}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                      {commentErrors[c.id] && (
                        <div className="mt-2 text-xs text-rose-600">
                          {commentErrors[c.id]}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {canModerate && (
                          <>
                            <ActionButton
                              icon={Eye}
                              onClick={() => moderateComment(c.id, "approve")}
                              loading={actionLoading === `approve-${c.id}`}
                            >
                              Approve
                            </ActionButton>
                            <ActionButton
                              icon={XCircle}
                              onClick={() => moderateComment(c.id, "hide")}
                              loading={actionLoading === `hide-${c.id}`}
                            >
                              Hide
                            </ActionButton>
                            <ActionButton
                              icon={Trash2}
                              variant="danger"
                              onClick={() => moderateComment(c.id, "remove")}
                              loading={actionLoading === `remove-${c.id}`}
                            >
                              Remove
                            </ActionButton>
                            {/* Override sentiment only */}
                            <ActionButton
                              icon={RefreshCw}
                              onClick={() => {
                                const newSentiment = window.prompt(
                                  "Override sentiment (positive/negative/neutral):",
                                  c.sentiment || "neutral",
                                );
                                if (
                                  newSentiment &&
                                  ["positive", "negative", "neutral"].includes(
                                    newSentiment,
                                  )
                                ) {
                                  moderateComment(c.id, "approve", "", {
                                    sentiment: {
                                      label: newSentiment,
                                      confidence: 1,
                                    },
                                  });
                                }
                              }}
                              loading={actionLoading === `override-${c.id}`}
                            >
                              Override
                            </ActionButton>
                            <ActionButton
                              icon={RefreshCw}
                              onClick={() => retryComment(c.id)}
                              loading={actionLoading === `retry-${c.id}`}
                            >
                              Retry AI
                            </ActionButton>
                          </>
                        )}
                        {canReplyOfficial && (
                          <ActionButton
                            icon={Reply}
                            onClick={() => replyOfficial(c.id)}
                            loading={actionLoading === `reply-${c.id}`}
                          >
                            Official Reply
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabPane>
        )}
      </Tabs>
    </div>
  );
}
