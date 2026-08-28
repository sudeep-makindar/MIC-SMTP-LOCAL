import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Campaign } from "@shared/types";
import type { DashboardStats } from "../types/api";
import StatTile from "../components/StatTile";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import { IconEmpty } from "../components/icons";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [interrupted, setInterrupted] = useState<Campaign[]>([]);
  const [recoveryTarget, setRecoveryTarget] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [s, rec] = await Promise.all([window.api.dashboard.stats(), window.api.recovery.check()]);
    setStats(s);
    if (rec.length > 0) {
      setInterrupted(rec);
      setRecoveryTarget(rec[0]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(decision: "resume" | "restart" | "discard") {
    if (!recoveryTarget) return;
    setBusy(true);
    await window.api.recovery.decide(recoveryTarget.id, decision);
    setBusy(false);
    const remaining = interrupted.filter((c) => c.id !== recoveryTarget.id);
    setInterrupted(remaining);
    setRecoveryTarget(remaining[0] ?? null);
    await load();
    if (decision !== "discard") {
      navigate(`/campaigns/${recoveryTarget.id}/send`);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Operational overview of local campaign activity</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/templates")}>
          Manage Templates
        </button>
      </div>

      {recoveryTarget && (
        <Modal title="Interrupted Campaign Detected" onClose={undefined}>
          <p>
            The campaign <strong>{recoveryTarget.name}</strong> was still sending when the application last closed
            unexpectedly.
          </p>
          <div className="grid grid-4" style={{ margin: "16px 0" }}>
            <StatTile label="Processed" value={recoveryTarget.sentCount + recoveryTarget.failedCount} />
            <StatTile label="Successful" value={recoveryTarget.sentCount} accent="success" />
            <StatTile label="Failed" value={recoveryTarget.failedCount} accent="danger" />
            <StatTile
              label="Remaining"
              value={recoveryTarget.totalRecipients - recoveryTarget.sentCount - recoveryTarget.failedCount - recoveryTarget.skippedCount}
              accent="primary"
            />
          </div>
          <p className="hint">
            Resume continues exactly where it left off. Restart re-queues failed recipients only. Discard cancels the
            campaign without deleting its history. Successfully sent recipients are never re-sent.
          </p>
          <div className="modal-footer" style={{ padding: "16px 0 0" }}>
            <button className="btn btn-outline-danger" disabled={busy} onClick={() => decide("discard")}>
              Discard
            </button>
            <button className="btn" disabled={busy} onClick={() => decide("restart")}>
              Restart Failed
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => decide("resume")}>
              Resume Campaign
            </button>
          </div>
        </Modal>
      )}

      {stats && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            <StatTile label="Total Campaigns" value={stats.totalCampaigns} />
            <StatTile label="Total Sent" value={stats.totalSent} accent="success" />
            <StatTile label="Total Failed" value={stats.totalFailed} accent="danger" />
            <StatTile label="Interrupted" value={stats.interruptedCount} accent="warning" />
          </div>

          {stats.activeCampaign && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3>Active Campaign</h3>
                <StatusBadge status={stats.activeCampaign.status} />
              </div>
              <div className="card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{stats.activeCampaign.name}</div>
                    <div className="text-muted" style={{ marginTop: 4 }}>
                      {stats.activeCampaign.sentCount} sent · {stats.activeCampaign.failedCount} failed ·{" "}
                      {stats.activeCampaign.totalRecipients - stats.activeCampaign.sentCount - stats.activeCampaign.failedCount - stats.activeCampaign.skippedCount}{" "}
                      remaining of {stats.activeCampaign.totalRecipients}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => navigate(`/campaigns/${stats.activeCampaign!.id}/send`)}>
                    Open Sending View
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3>Recent Campaigns</h3>
            </div>
            {stats.recentCampaigns.length === 0 ? (
              <div className="empty-state">
                <div className="icon">
                  <IconEmpty size={26} />
                </div>
                <div>No campaigns yet. Create your first one to get started.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Recipients</th>
                    <th>Sent</th>
                    <th>Failed</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentCampaigns.map((c) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => openCampaign(c)}>
                      <td style={{ fontWeight: 600, color: "var(--text-0)" }}>{c.name}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>{c.totalRecipients}</td>
                      <td className="text-success">{c.sentCount}</td>
                      <td className="text-danger">{c.failedCount}</td>
                      <td className="text-muted">{new Date(c.updatedAt).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openCampaign(c); }}>
                          Open →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );

  function openCampaign(c: Campaign) {
    if (c.status === "sending" || c.status === "paused") navigate(`/campaigns/${c.id}/send`);
    else if (c.status === "completed" || c.status === "failed" || c.status === "cancelled") navigate(`/campaigns/${c.id}`);
    else navigate(`/campaigns/${c.id}/wizard`);
  }
}
