import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom"; // add useSearchParams
import { plannerApi } from "../api/plannerApi";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { Modal } from "../components/Modal";
import { formatDate, daysRemaining } from "../lib/format";

export function PendingInvitationsPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState([]);
  const [previewInvitation, setPreviewInvitation] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const invitations = await plannerApi.getPendingInvitations();
      console.log("Invitations:", invitations);
      setInvitations(invitations);
    } catch (err) {
      setError(err.message || "Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  // Effect for highlighting
  useEffect(() => {
    if (highlightId && invitations.length > 0) {
      // Wait for DOM to render
      setTimeout(() => {
        const element = document.getElementById(`invitation-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add(
            "ring-2",
            "ring-teal-500",
            "bg-teal-50",
            "transition-all",
          );
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-teal-500", "bg-teal-50");
          }, 3000);
        }
      }, 100);
    }
  }, [highlightId, invitations]);

  const handleAccept = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      await plannerApi.acceptInvitation(invitationId);
      await loadInvitations();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      await plannerApi.rejectInvitation(invitationId, "User declined");
      await loadInvitations();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingState label="Loading invitations" />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      <PageHeader
        title="Pending Invitations"
        description="Invitations to become an associate on policies"
      />
      {invitations.length === 0 ? (
        <div className="mt-6 rounded-lg border bg-white p-8 text-center text-slate-500">
          No pending invitations.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {invitations.map((inv) => (
            <div
              key={inv._id}
              id={`invitation-${inv._id}`}
              className="rounded-lg border bg-white p-4 shadow-sm transition"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold text-slate-950">
                  {inv.policyId.title}
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                  Expires in {inv.daysRemaining} days
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {inv.policyId.description?.slice(0, 120)}...
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>Invited by: {inv.assignedBy?.email}</span>
                <span>Permissions: {inv.permissions.join(", ")}</span>
                <span>Invited: {formatDate(inv.invitedAt)}</span>
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setPreviewInvitation(inv)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Preview Policy
                </button>
                <button
                  onClick={() => handleAccept(inv._id)}
                  disabled={actionLoading === inv._id}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(inv._id)}
                  disabled={actionLoading === inv._id}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal – same as before */}
      {previewInvitation && (
        <Modal
          title={`Policy: ${previewInvitation.policyId.title}`}
          onClose={() => setPreviewInvitation(null)}
          size="lg"
        >
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {previewInvitation.policyId.description}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-semibold">Status:</span>
              <span>{previewInvitation.policyId.status}</span>
              <span className="font-semibold">Start Date:</span>
              <span>{formatDate(previewInvitation.policyId.startDate)}</span>
              <span className="font-semibold">End Date:</span>
              <span>{formatDate(previewInvitation.policyId.endDate)}</span>
              <span className="font-semibold">Poll Type:</span>
              <span>{previewInvitation.policyId.pollType}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setPreviewInvitation(null);
                  handleAccept(previewInvitation._id);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-white"
              >
                Accept Now
              </button>
              <button
                onClick={() => setPreviewInvitation(null)}
                className="rounded-lg border px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
