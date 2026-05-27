import { Activity, FileText, Star, Vote, File, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/admin";
import { policyApi } from "../api/policies";
import { useAuth } from "../auth/AuthContext";
import { AIHealthCard } from "../components/AIHealthCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
  formatDate,
  formatNumber,
  formatRating,
  getErrorMessage,
} from "../lib/format";

export function DashboardPage() {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminStats, setAdminStats] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        if (role === "admin") {
          const stats = await adminApi.dashboardStats();
          if (active) setAdminStats(stats);
          const auditLogs = await adminApi.getAuditLogs({ limit: 5 });
          if (active) setRecentAuditLogs(auditLogs.logs || []);
        }

        const policyResult = await policyApi.list({
          owner: role === "planner" ? "me" : undefined,
          limit: 100,
        });
        if (active) setPolicies(policyResult.policies || []);
      } catch (err) {
        if (active)
          setError(getErrorMessage(err, "Failed to load dashboard data"));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [role]);

  if (loading) return <LoadingState label="Loading dashboard" />;

  const stats = adminStats || {};

  // Calculate planner's own policy counts
  const draftCount = policies.filter(p => p.status === "draft").length;
  const activeCount = policies.filter(p => p.status === "active").length;
  const totalMyPolicies = policies.length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A concise summary of policy activity, voting volume, and current engagement signals."
        actions={
          <Link
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
            to="/policies/new"
          >
            Create policy
          </Link>
        }
      />
      <ErrorAlert message={error} />

      {/* Row 1: Platform overview (admin) or Planner's own stats */}
      <div className={`grid gap-4 ${role === "admin" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {role === "admin" ? (
          <>
            <Link
              to="/policies?status=active"
              className="block transition hover:opacity-80"
            >
              <MetricCard
                label="Active policies"
                value={formatNumber(stats.policies?.active || 0)}
                icon={FileText}
                helper="Currently open for voting"
              />
            </Link>
            <MetricCard
              label="Total votes"
              value={formatNumber(stats.votes?.total || 0)}
              icon={Vote}
              helper={`${formatNumber(stats.votes?.app)} app, ${formatNumber(stats.votes?.sms)} SMS`}
            />
          </>
        ) : (
          <>
            <MetricCard
              label="My Draft Policies"
              value={draftCount}
              icon={File}
              helper="Policies not yet published"
            />
            <MetricCard
              label="My Active Policies"
              value={activeCount}
              icon={PlayCircle}
              helper="Currently open for voting"
            />
            <MetricCard
              label="My Policies (Total)"
              value={totalMyPolicies}
              icon={FileText}
              helper="All policies you own"
            />
          </>
        )}
      </div>

      {/* Row 2: Admin specific (Active planners, Pending comments, AI health) */}
      {role === "admin" && stats.planners && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link to="/planners" className="block transition hover:opacity-80">
            <MetricCard
              label="Active planners"
              value={formatNumber(stats.planners?.active || 0)}
              icon={Activity}
              helper={`${formatNumber(stats.planners?.total)} total planners`}
            />
          </Link>
          <Link
            to="/comments/pending"
            className="block transition hover:opacity-80"
          >
            <MetricCard
              label="Pending comments"
              value={formatNumber(stats.comments?.pendingReview || 0)}
              helper="Awaiting moderation or AI retry"
            />
          </Link>
          <AIHealthCard />
        </div>
      )}

      {/* Row 3: Recent Activity (admin only) */}
      {role === "admin" && (
        <div className="mt-4 rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold text-slate-950">Recent Activity</h3>
            <Link
              to="/audit-logs"
              className="text-sm font-bold text-teal-700 hover:text-teal-900"
            >
              View all →
            </Link>
          </div>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {recentAuditLogs.map((log) => (
                <div
                  key={log._id}
                  className="border-b border-slate-100 pb-2 last:border-0"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {log.action}
                  </p>
                  <p className="text-xs text-slate-500">
                    {log.userId?.email || "System"} • {formatDate(log.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Row 4: Recent Policies (shared) */}
      <div className="mt-4 rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-950">
            {role === "admin" ? "Recent Policies" : "My Recent Policies"}
          </h3>
          <Link
            to="/policies"
            className="text-sm font-bold text-teal-700 hover:text-teal-900"
          >
            View all →
          </Link>
        </div>
        {policies.length === 0 ? (
          <EmptyState
            title="No policies yet"
            description="Create a policy to start collecting feedback."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {policies.slice(0, 6).map((policy) => (
              <Link
                key={policy.id}
                to={`/policies/${policy.id}`}
                className="grid gap-3 py-4 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <div>
                  <p className="font-semibold text-slate-950">{policy.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {policy.policyCode} • {policy.targetRegions?.join(", ")}
                  </p>
                </div>
                <StatusBadge status={policy.status} />
                <p className="text-sm text-slate-500">
                  {formatDate(policy.startDate)} to {formatDate(policy.endDate)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}