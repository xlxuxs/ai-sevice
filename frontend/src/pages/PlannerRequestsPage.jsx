import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { plannerApi } from "../api/planners";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";

export function PlannerRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const result = await plannerApi.listPendingRequests();
      setRequests(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load planner requests"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approve(request) {
    setActionLoading(request._id);
    setError("");
    setNotice("");
    try {
      await plannerApi.approveRequest(request._id);
      setNotice("Planner request approved.");
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to approve request"));
    } finally {
      setActionLoading("");
    }
  }

  async function reject() {
    if (!rejecting) return;
    if (reason.trim().length < 10) {
      setError("Rejection reason must be at least 10 characters.");
      return;
    }
    setActionLoading(rejecting._id);
    setError("");
    setNotice("");
    try {
      await plannerApi.rejectRequest(rejecting._id, reason.trim());
      setNotice("Planner request rejected.");
      setRejecting(null);
      setReason("");
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reject request"));
    } finally {
      setActionLoading("");
    }
  }

  if (loading) return <LoadingState label="Loading planner requests" />;

  return (
    <div>
      <PageHeader title="Planner Requests" description="Review citizen requests for planner access." />
      <ErrorAlert message={error} />
      {notice ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      {requests.length ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Applicant</th>
                <th className="px-4 py-3 font-bold">Organization</th>
                <th className="px-4 py-3 font-bold">Reason</th>
                <th className="px-4 py-3 font-bold">Submitted</th>
                <th className="px-4 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={request._id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">{request.userId?.email || "Unknown"}</p>
                    <p className="text-xs text-slate-500">{request.userId?.region || "No region"}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{request.organization || "None"}</td>
                  <td className="max-w-lg px-4 py-4 text-slate-700">{request.reason}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionLoading === request._id}
                        onClick={() => approve(request)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === request._id}
                        onClick={() => setRejecting(request)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <EmptyState title="No pending planner requests" description="New citizen requests will appear here." />
      )}

      {rejecting ? (
        <Modal title="Reject planner request" onClose={() => setRejecting(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Provide a reason for rejecting {rejecting.userId?.email || "this applicant"}.</p>
            <textarea
              rows="4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setRejecting(null)}>Cancel</button>
              <button type="button" className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800" onClick={reject}>Reject</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
