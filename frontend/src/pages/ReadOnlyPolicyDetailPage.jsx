import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { policyApi } from "../api/policies";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, getErrorMessage } from "../lib/format";
import { BarChart3, Copy } from "lucide-react";

export function ReadOnlyPolicyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    policyApi
      .get(id)
      .then(setPolicy)
      .catch((err) => setError(err.message || "Failed to load policy"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleClone = async () => {
    setError("");
    try {
      const result = await policyApi.clone(id);
      // Redirect to the edit page of the cloned draft
      navigate(`/policies/${result.id}/edit`);
    } catch (err) {
      setError(getErrorMessage(err, "Clone failed"));
    }
  };

  if (loading) return <LoadingState label="Loading policy details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!policy) return <div>Policy not found</div>;

  const showAnalytics = ["active", "paused", "closed", "archived"].includes(
    policy.status,
  );

  return (
    <div>
      <PageHeader
        title={policy.title}
        description={`Policy Code: ${policy.policyCode} • Read‑only view`}
        actions={
          <div className="flex gap-2">
            {showAnalytics && (
              <button
                onClick={() => navigate(`/policies/${id}/analytics`)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <BarChart3 className="h-4 w-4" />
                View Analytics
              </button>
            )}
            <button
              onClick={handleClone}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
            >
              <Copy className="h-4 w-4" />
              Clone Policy
            </button>
          </div>
        }
      />
      <ErrorAlert message={error} />
      <div className="mt-5 rounded-lg border bg-white p-5 shadow-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <dt className="font-semibold">Description:</dt>
          <dd className="text-slate-700">{policy.description}</dd>
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
          <dt className="font-semibold">Created By:</dt>
          <dd>{policy.createdBy?.email || "Unknown"}</dd>
        </dl>
      </div>
    </div>
  );
}
