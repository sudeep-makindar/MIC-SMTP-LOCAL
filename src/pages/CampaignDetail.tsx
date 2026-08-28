import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Campaign, Recipient } from "@shared/types";
import StatusBadge from "../components/StatusBadge";
import StatTile from "../components/StatTile";
import { confirmAction } from "../lib/dialogStore";

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    window.api.campaigns.get(id).then(setCampaign);
    window.api.recipients.list(id).then(setRecipients);
  }, [id]);

  if (!campaign || !id) return <div className="text-muted">Loading…</div>;

  const filtered = filter === "all" ? recipients : recipients.filter((r) => r.status === filter);

  async function exportResults(format: "csv" | "xlsx") {
    setExporting(true);
    setExportMsg(null);
    try {
      const result = await window.api.logs.exportCampaign(id!, format);
      setExportMsg(`Exported to ${result.path}`);
    } finally {
      setExporting(false);
    }
  }

  async function deleteCampaign() {
    const ok = await confirmAction(
      "This removes the campaign folder and its recipient records. Master log history is preserved.",
      { title: `Delete "${campaign?.name}"?`, confirmLabel: "Delete Campaign", danger: true }
    );
    if (!ok) return;
    await window.api.campaigns.delete(id!);
    navigate("/");
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">{campaign.description || "No description"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <StatusBadge status={campaign.status} />
          {(campaign.status === "draft" || campaign.status === "ready" || campaign.status === "paused" || campaign.status === "interrupted") && (
            <button className="btn btn-primary" onClick={() => navigate(`/campaigns/${id}/wizard`)}>
              Continue Setup
            </button>
          )}
          {(campaign.status === "sending" || campaign.status === "paused") && (
            <button className="btn btn-primary" onClick={() => navigate(`/campaigns/${id}/send`)}>
              Open Sending View
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatTile label="Total Recipients" value={campaign.totalRecipients} />
        <StatTile label="Sent" value={campaign.sentCount} accent="success" />
        <StatTile label="Failed" value={campaign.failedCount} accent="danger" />
        <StatTile label="Skipped/Excluded" value={campaign.skippedCount} accent="warning" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Recipient Results</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="excluded">Excluded</option>
              <option value="pending">Pending</option>
            </select>
            <button className="btn btn-sm" disabled={exporting} onClick={() => exportResults("csv")}>
              Export CSV
            </button>
            <button className="btn btn-sm" disabled={exporting} onClick={() => exportResults("xlsx")}>
              Export XLSX
            </button>
          </div>
        </div>
        {exportMsg && (
          <div className="banner banner-info" style={{ margin: "12px 20px 0" }}>
            {exportMsg}
          </div>
        )}
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Sent At</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>
                    <span className={`badge badge-${r.status === "sent" ? "completed" : r.status === "failed" ? "failed" : "draft"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.attempts}</td>
                  <td className="text-muted">{r.sentAt ?? "—"}</td>
                  <td className="text-muted">{r.errorReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hint">Deleting a campaign removes its folder and recipient rows. Its entries remain in the master communication log.</div>
          <button className="btn btn-outline-danger btn-sm" onClick={deleteCampaign}>
            Delete Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
