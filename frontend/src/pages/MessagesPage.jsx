import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { messageApi } from "../api/messages";
import { plannerApi } from "../api/planners";
import { LANGUAGES } from "../constants/regions";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";

export function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [planners, setPlanners] = useState([]);
  const [language, setLanguage] = useState("all");
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "" });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadInbox() {
    setLoading(true);
    setError("");
    try {
      const result = await messageApi.inbox({ limit: 50 });
      setMessages(result.messages || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load inbox"));
    } finally {
      setLoading(false);
    }
  }

  async function searchPlanners(nextLanguage = language) {
    setError("");
    try {
      const result = await plannerApi.search(nextLanguage);
      setPlanners(Array.isArray(result) ? result : []);
    } catch (err) {
      // If search fails, try to get all planners without language filter
      try {
        // For now, let's create a fallback - we might need to add an API endpoint for all planners
        setPlanners([]);
        setError("No planners found for the selected language. Try selecting 'All' or contact admin.");
      } catch (fallbackErr) {
        setError(getErrorMessage(err, "Failed to search planners"));
      }
    }
  }

  useEffect(() => {
    loadInbox();
    searchPlanners("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.recipientId || !form.subject.trim() || !form.body.trim()) {
      setError("Recipient, subject, and body are required.");
      return;
    }
    setSending(true);
    try {
      await messageApi.send(form);
      setNotice("Message sent.");
      setForm({ recipientId: "", subject: "", body: "" });
      await loadInbox();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send message"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader title="Messages" description="Send collaboration messages and review your inbox." />
      <ErrorAlert message={error} />
      {notice ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Send message</h3>
          <div className="mt-4 flex gap-2">
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                searchPlanners(event.target.value);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              {LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button type="button" onClick={() => searchPlanners()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Search</button>
          </div>
          <form className="mt-4 space-y-3" onSubmit={sendMessage}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Recipient</span>
              <select value={form.recipientId} onChange={(event) => setForm((current) => ({ ...current, recipientId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600">
                <option value="">Choose a planner</option>
                {planners.map((planner) => <option key={planner._id} value={planner._id}>{planner.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Subject</span>
              <input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Body</span>
              <textarea rows="6" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600" />
            </label>
            <button disabled={sending} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
              <Send className="h-4 w-4" />
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-950">Inbox</h3>
          {loading ? <LoadingState label="Loading inbox" /> : messages.length ? (
            <div className="divide-y divide-slate-100">
              {messages.map((message) => (
                <Link key={message._id} to={`/messages/${message._id}`} className="block py-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{message.subject}</p>
                      <p className="mt-1 text-sm text-slate-500">From {message.senderId?.email || "Unknown"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${message.read ? "bg-slate-100 text-slate-600" : "bg-teal-100 text-teal-700"}`}>{message.read ? "Read" : "New"}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{message.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="No messages" description="Incoming collaboration messages will appear here." />}
        </section>
      </div>
    </div>
  );
}
