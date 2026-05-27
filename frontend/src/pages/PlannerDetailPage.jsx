import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { adminApi } from "../api/admin";
import { policyApi } from "../api/policies";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, getErrorMessage } from "../lib/format";
import { Save } from "lucide-react";

function generatePassword() {
  const random = Math.random().toString(36).slice(2, 8);
  return `Planner-${random}42`;
}

export function PlannerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [planner, setPlanner] = useState(null);
  const [ownedPolicies, setOwnedPolicies] = useState([]);
  const [delegatedPolicies, setDelegatedPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPlanner, setEditingPlanner] = useState(null);
  const [editPassword, setEditPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const from = location.state?.from;

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const plannerData = await adminApi.getPlanner(id);
      setPlanner(plannerData);

      // Use enhanced fields from backend if available, otherwise fallback to separate API call
      if (plannerData.ownedPolicies) {
        setOwnedPolicies(plannerData.ownedPolicies);
      } else {
        const policiesData = await policyApi.list({ owner: id, limit: 100 });
        setOwnedPolicies(policiesData.policies || []);
      }

      if (plannerData.delegatedPolicies) {
        setDelegatedPolicies(plannerData.delegatedPolicies);
      } else {
        setDelegatedPolicies([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load planner data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const toggleStatus = async () => {
    if (!planner) return;

    setError("");
    setActionLoading("status");

    try {
      const updatedActive = !planner.active;

      await adminApi.setPlannerStatus(planner._id, updatedActive);

      // update local planner instantly
      setPlanner((prev) => ({
        ...prev,
        active: updatedActive,
      }));

      // keep edit modal in sync if open
      setEditingPlanner((prev) =>
        prev ? { ...prev, active: updatedActive } : prev,
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update status"));
    } finally {
      setActionLoading("");
    }
  };

  const resetPassword = async () => {
    if (!planner) return;

    setError("");
    setActionLoading("reset");

    try {
      await adminApi.initiatePasswordReset(planner._id);

      alert(`Password reset email sent to ${planner.email}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send reset email"));
    } finally {
      setActionLoading("");
    }
  };
  const savePlannerEdit = async () => {
    if (!editingPlanner) return;

    setError("");

    if (editPassword && editPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const payload = {
      active: editingPlanner.active,
      ...(editPassword && {
        password: editPassword,
      }),
    };

    try {
      setSubmitting(true);

      await adminApi.updatePlanner(editingPlanner._id, payload);

      // update planner locally
      setPlanner((prev) => ({
        ...prev,
        active: editingPlanner.active,
      }));

      setEditingPlanner(null);
      setEditPassword("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update planner"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToPlanners = () => {
    if (from?.pathname === "/planners" && from.search) {
      navigate(from.pathname + from.search);
    } else {
      navigate("/planners");
    }
  };

  const handleBackToPolicies = () => {
    if (from?.pathname === "/policies") {
      navigate(from.pathname + (from.search || ""));
    } else {
      navigate("/policies");
    }
  };

  if (loading) return <LoadingState label="Loading planner details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!planner)
    return (
      <EmptyState
        title="Planner not found"
        description="The planner does not exist or has been removed."
      />
    );

  return (
    <div>
      <PageHeader
        title={`Planner: ${planner.email}`}
        description="View planner details, manage account, and see their policies."
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleBackToPlanners}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              ← Back to Planners
            </button>
            {from?.pathname === "/policies" && (
              <button
                onClick={handleBackToPolicies}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Back to Policies
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-3">
        <ErrorAlert message={error} />
      </div>

      {/* Planner Profile Card */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              {planner.email}
            </h3>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>
                <span className="font-semibold">Region:</span>{" "}
                {planner.region || "Not set"}
              </p>
              <p>
                <span className="font-semibold">Age range:</span>{" "}
                {planner.ageRange || "Not set"}
              </p>
              <p>
                <span className="font-semibold">Gender:</span>{" "}
                {planner.gender || "Not set"}
              </p>
              <p>
                <span className="font-semibold">Occupation:</span>{" "}
                {planner.occupation || "Not set"}
              </p>
              <p>
                <span className="font-semibold">Education:</span>{" "}
                {planner.education || "Not set"}
              </p>
              <p>
                <span className="font-semibold">Languages spoken:</span>{" "}
                {planner.languagesSpoken?.join(", ") || "None"}
              </p>
              <p>
                <span className="font-semibold">Training completed:</span>{" "}
                {planner.trainingCompletedAt
                  ? formatDate(planner.trainingCompletedAt)
                  : "No"}
              </p>
              <p>
                <span className="font-semibold">Joined:</span>{" "}
                {formatDate(planner.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleStatus}
              disabled={actionLoading === "status"}
              className={`rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                planner.active
                  ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                  : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {actionLoading === "status"
                ? "Updating..."
                : planner.active
                  ? "Deactivate Account"
                  : "Activate Account"}
            </button>
            <button
              onClick={resetPassword}
              disabled={actionLoading === "reset"}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {actionLoading === "reset" ? "Sending..." : "Reset Password"}
            </button>
          </div>
        </div>
      </div>

      {/* Policies Owned by This Planner */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-lg font-bold text-slate-950">Policies Owned</h3>
          <p className="text-sm text-slate-600">
            All policies created by this planner (all statuses).
          </p>
        </div>
        {ownedPolicies.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            This planner has not created any policies yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Title</th>
                  <th className="px-4 py-3 font-bold">Policy Code</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Start Date</th>
                  <th className="px-4 py-3 font-bold">End Date</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownedPolicies.map((policy) => (
                  <tr key={policy.id || policy._id}>
                    <td className="px-4 py-4 font-semibold text-slate-950">
                      <Link
                        to={`/policies/${policy.id || policy._id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {policy.title}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">
                      {policy.policyCode}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={policy.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(policy.startDate)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(policy.endDate)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {["active", "paused", "closed"].includes(
                          policy.status,
                        ) && (
                          <Link
                            to={`/policies/${policy.id || policy._id}/analytics`}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Analytics
                          </Link>
                        )}
                        <Link
                          to={`/policies/${policy.id || policy._id}/history`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          History
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW: Delegated Policies (where planner is an associate) */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-lg font-bold text-slate-950">
            Delegated Policies
          </h3>
          <p className="text-sm text-slate-600">
            Policies where this planner is an accepted associate.
          </p>
        </div>
        {delegatedPolicies.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            This planner is not an associate on any policy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Policy Title</th>
                  <th className="px-4 py-3 font-bold">Policy Code</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Permissions</th>
                  <th className="px-4 py-3 font-bold">Invited By</th>
                  <th className="px-4 py-3 font-bold">Accepted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delegatedPolicies.map((item) => (
                  <tr key={item.associateId}>
                    <td className="px-4 py-4 font-semibold text-slate-950">
                      <Link
                        to={`/policies/${item.policy._id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {item.policy.title}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">
                      {item.policy.policyCode}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.policy.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.permissions.join(", ")}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.invitedBy?.email || "Unknown"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(item.acceptedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal (unchanged) */}
      {editingPlanner ? (
        <Modal
          title={`Edit ${editingPlanner.email}`}
          onClose={() => setEditingPlanner(null)}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700"
                checked={editingPlanner.active}
                onChange={(event) =>
                  setEditingPlanner((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />
              Account active
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={savePlannerEdit}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {submitting ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setEditPassword(generatePassword())}
              >
                Generate password
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
