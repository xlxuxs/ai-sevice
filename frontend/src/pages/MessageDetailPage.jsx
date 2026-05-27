import { ArrowLeft, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { messageApi } from "../api/messages";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";

export function MessageDetailPage() {
  const { id } = useParams();
  const [message, setMessage] = useState(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadMessage() {
    setLoading(true);
    setError("");
    try {
      setMessage(await messageApi.get(id));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load message"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function sendReply(event) {
    event.preventDefault();
    if (!reply.trim()) {
      setError("Reply body is required.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      await messageApi.reply(id, reply.trim());
      setReply("");
      setNotice("Reply sent.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send reply"));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingState label="Loading message" />;

  return (
    <div>
      <PageHeader
        title={message?.subject || "Message"}
        description={message ? `From ${message.senderId?.email || "Unknown"} to ${message.recipientId?.email || "Unknown"} • ${formatDate(message.createdAt)}` : ""}
        actions={<Link to="/messages" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />Inbox</Link>}
      />
      <ErrorAlert message={error} />
      {notice ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      {message ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
        </section>
      ) : null}

      <form onSubmit={sendReply} className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Reply</span>
          <textarea rows="5" value={reply} onChange={(event) => setReply(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600" />
        </label>
        <button disabled={sending} type="submit" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
          <Send className="h-4 w-4" />
          {sending ? "Sending..." : "Send reply"}
        </button>
      </form>
    </div>
  );
}
