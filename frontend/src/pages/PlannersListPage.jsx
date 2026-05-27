import { Lock, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { adminApi } from "../api/admin";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";

export function PlannersListPage() {
  const location = useLocation();
  const [planners, setPlanners] = useState([]);
  const [totalPlanners, setTotalPlanners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedPlanner, setSelectedPlanner] = useState(null);
  const [modalMessage, setModalMessage] = useState(null);

  const loadPlanners = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listPlanners({
        page,
        limit: 20,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      });
      setPlanners(result.planners || []);
      setTotalPlanners(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load planners"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanners();
  }, [page, activeFilter]);

  const filtered = searchEmail.trim()
    ? planners.filter((p) =>
        p.email.toLowerCase().includes(searchEmail.toLowerCase()),
      )
    : planners;

  const toggleStatus = async (planner) => {
    setError("");
    setActionLoading((prev) => ({ ...prev, [planner._id]: true }));
    try {
      const updatedActive = !planner.active;
      await adminApi.setPlannerStatus(planner._id, updatedActive);
      setPlanners((prev) =>
        prev.map((p) =>
          p._id === planner._id ? { ...p, active: updatedActive } : p,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update planner status"));
    } finally {
      setActionLoading((prev) => ({ ...prev, [planner._id]: false }));
    }
  };

  const openResetModal = (planner) => {
    setSelectedPlanner(planner);
    setModalMessage(null);
    setResetModalOpen(true);
  };

  const handlePasswordReset = async () => {
    if (!selectedPlanner) return;
    setError("");
    setModalMessage(null);
    setActionLoading((prev) => ({
      ...prev,
      [`reset-${selectedPlanner._id}`]: true,
    }));
    try {
      await adminApi.initiatePasswordReset(selectedPlanner._id);
      setModalMessage({
        type: "success",
        text: "Reset email sent successfully!",
      });
      setTimeout(() => {
        setResetModalOpen(false);
        setSelectedPlanner(null);
        setModalMessage(null);
      }, 2000);
    } catch (err) {
      setModalMessage({
        type: "error",
        text: getErrorMessage(err, "Failed to send reset email"),
      });
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [`reset-${selectedPlanner._id}`]: false,
      }));
    }
  };

  if (loading) return <LoadingState label="Loading planners" />;

  return (
    <div>
      <PageHeader
        title="Planner accounts"
        description="View, filter, and manage planner accounts. Activate or deactivate users and send password reset emails."
      />
      <div className="space-y-5">
        <ErrorAlert message={error} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Total planners: {totalPlanners}
            </span>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
            <p className="text-slate-600">No planners found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Created At
                  </th>
                  <th className="px-5 py-3 text-right font-bold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((planner) => (
                  <tr
                    key={planner._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/planners/${planner._id}`}
                        state={{
                          from: {
                            pathname: "/planners",
                            search: location.search,
                            label: "Planners",
                          },
                        }}
                        className="font-medium text-slate-950 hover:text-teal-700 hover:underline"
                      >
                        {planner.email}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${
                          planner.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {planner.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {formatDate(planner.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(planner)}
                          disabled={actionLoading[planner._id]}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            planner.active
                              ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                              : "border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          } disabled:opacity-50`}
                        >
                          {actionLoading[planner._id]
                            ? "..."
                            : planner.active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          onClick={() => openResetModal(planner)}
                          disabled={actionLoading[`reset-${planner._id}`]}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {actionLoading[`reset-${planner._id}`]
                            ? "Sending..."
                            : "Reset password"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {resetModalOpen && selectedPlanner && (
        <Modal title="Reset Password" onClose={() => setResetModalOpen(false)}>
          <div className="space-y-4">
            {modalMessage && (
              <div
                className={`rounded-lg p-3 text-sm font-semibold ${
                  modalMessage.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-rose-50 border border-rose-200 text-rose-700"
                }`}
              >
                {modalMessage.text}
              </div>
            )}
            {!modalMessage && (
              <>
                <p className="text-sm text-slate-600">
                  Send a password reset email to{" "}
                  <strong>{selectedPlanner.email}</strong>?
                </p>
                <p className="text-sm text-slate-500">
                  They will receive an email with a link to create a new
                  password. The link expires in 1 hour.
                </p>
              </>
            )}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setResetModalOpen(false)}
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {!modalMessage && (
                <button
                  onClick={handlePasswordReset}
                  disabled={actionLoading[`reset-${selectedPlanner._id}`]}
                  type="button"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {actionLoading[`reset-${selectedPlanner._id}`]
                    ? "Sending..."
                    : "Send reset email"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
