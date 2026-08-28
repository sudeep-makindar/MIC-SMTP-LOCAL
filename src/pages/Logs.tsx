import { useEffect, useState } from "react";
import type { SendLogEntry } from "@shared/types";
import type { LogSearchFilters } from "../types/api";
import Modal from "../components/Modal";

export default function Logs() {
  const [filters, setFilters] = useState<LogSearchFilters>({});
  const [results, setResults] = useState<SendLogEntry[]>([]);
  const [historyEmail, setHistoryEmail] = useState<string | null>(null);
  const [history, setHistory] = useState<SendLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const r = await window.api.logs.search(filters);
      setResults(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openHistory(email: string) {
    setHistoryEmail(email);
    const h = await window.api.logs.recipientHistory(email);
    setHistory(h);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Master Communication Log</h1>
          <p className="page-subtitle">Every email attempt ever made by this application, across all campaigns</p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field-row">
          <div className="field">
            <label>Email</label>
            <input
              value={filters.email ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
              placeholder="rahul@example.com"
            />
          </div>
          <div className="field">
            <label>Subject</label>
            <input
              value={filters.subject ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Certificate"
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={filters.status ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}>
              <option value="">Any</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="excluded">Excluded</option>
            </select>
          </div>
          <div className="field">
            <label>From Date</label>
            <input type="date" onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
          </div>
          <div className="field">
            <label>To Date</label>
            <input type="date" onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : undefined }))} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={search} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Results ({results.length})</h3>
        </div>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Campaign</th>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Attempt</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {results.map((entry) => (
                <tr key={entry.id} style={{ cursor: "pointer" }} onClick={() => openHistory(entry.recipient)}>
                  <td className="text-muted">{new Date(entry.timestamp).toLocaleString()}</td>
                  <td>{entry.campaignName}</td>
                  <td>{entry.recipient}</td>
                  <td>{entry.subject}</td>
                  <td>
                    <span className={`badge badge-${entry.status === "sent" ? "completed" : "failed"}`}>{entry.status}</span>
                  </td>
                  <td>{entry.attemptNumber}</td>
                  <td className="text-muted">{entry.failureReason ?? "—"}</td>
                </tr>
              ))}
              {results.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-muted" style={{ textAlign: "center", padding: 24 }}>
                    No log entries match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyEmail && (
        <Modal title={`History — ${historyEmail}`} onClose={() => setHistoryEmail(null)}>
          {history.length === 0 ? (
            <div className="text-muted">No prior history.</div>
          ) : (
            history.map((h) => (
              <div key={h.id} className="checklist-item">
                <span className={`badge badge-${h.status === "sent" ? "completed" : "failed"}`}>{h.status}</span>
                <div style={{ flex: 1 }}>
                  <div>{h.subject}</div>
                  <div className="text-muted" style={{ fontSize: 11.5 }}>
                    {new Date(h.timestamp).toLocaleString()} · {h.campaignName}
                  </div>
                </div>
              </div>
            ))
          )}
        </Modal>
      )}
    </div>
  );
}
