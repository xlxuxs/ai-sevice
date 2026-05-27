import { CalendarClock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { adminApi } from "../api/admin";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { MetricCard } from "../components/MetricCard";
import {
  getErrorMessage,
  toIsoFromDateInput,
  toDateInput,
} from "../lib/format";

export function TrendsDashboardPage() {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interval, setInterval] = useState("day");
  const [dates, setDates] = useState(() => ({
    startDate: toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate: toDateInput(new Date()),
  }));

  const loadTrends = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.getTrends({
        interval,
        startDate: dates.startDate
          ? toIsoFromDateInput(dates.startDate)
          : undefined,
        endDate: dates.endDate
          ? toIsoFromDateInput(dates.endDate, true)
          : undefined,
      });
      setTrends(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load trends"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  const handleDateChange = (field, value) => {
    setDates((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilter = () => {
    loadTrends();
  };

  const trendData = trends?.data || [];
  const totalVotes = trends?.totalVotes || 0;
  const totalNewUsers = trends?.newUsers || 0;

  if (loading) return <LoadingState label="Loading trends" />;

  return (
    <div>
      <PageHeader
        title="Trends & Analytics"
        description="View voting and user registration trends over time across all policies."
      />

      <div className="space-y-5">
        <ErrorAlert message={error} />

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-5 w-5 text-slate-600" />
            <h3 className="font-bold text-slate-900">Filters</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Start Date
              </span>
              <input
                type="date"
                value={dates.startDate}
                onChange={(e) => handleDateChange("startDate", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                End Date
              </span>
              <input
                type="date"
                value={dates.endDate}
                onChange={(e) => handleDateChange("endDate", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleApplyFilter}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
            >
              <RefreshCw className="h-4 w-4" />
              Apply Filter
            </button>
          </div>
        </div>

        {trends && (
          <div className="space-y-5">
            {/* Summary Metrics */}
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Total Votes" value={totalVotes} />
              <MetricCard label="New Users" value={totalNewUsers} />
            </div>

            {trendData.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
                <p className="text-slate-600">
                  No trends data found for the selected date range.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">
                  Votes & New Users Over Time
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="votes"
                      stroke="#0d9488"
                      strokeWidth={2}
                      name="Votes"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="newUsers"
                      stroke="#2563eb"
                      strokeWidth={2}
                      name="New Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
