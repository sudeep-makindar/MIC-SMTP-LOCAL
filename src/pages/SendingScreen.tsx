import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Campaign, Recipient, RenderedEmail, SendProgress } from "@shared/types";
import StatusBadge from "../components/StatusBadge";
import StatTile from "../components/StatTile";
import ProgressBar from "../components/ProgressBar";
import EmailPreviewFrame from "../components/EmailPreviewFrame";
import Modal from "../components/Modal";
import { confirmAction } from "../lib/dialogStore";

export default function SendingScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const [nextManual, setNextManual] = useState<Recipient | null>(null);
  const [failed, setFailed] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const lastPreviewedId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const c = await window.api.campaigns.get(id);
    setCampaign(c);
    const recipients = await window.api.recipients.list(id);
    setFailed(recipients.filter((r) => r.status === "failed"));
    if (c?.sendingMode === "manual") {
      const next = await window.api.sending.getNextPending(id);
      setNextManual(next);
      if (next) {
        const rendered = await window.api.preview.renderRecipient(id, next.id);
        setPreview(rendered);
      } else {
        setPreview(null);
      }
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // A campaign only reaches this screen once it's been confirmed for
    // sending. If it's still a draft (e.g. a stale link or manual URL edit),
    // there's nothing to control here — send the operator back to finish
    // setup instead of showing sending controls for a campaign that never
    // started.
    if (campaign && campaign.status === "draft" && id) {
      navigate(`/campaigns/${id}/wizard`, { replace: true });
    }
  }, [campaign, id, navigate]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = window.api.sending.onProgress((p) => {
      if (p.campaignId !== id) return;
      setProgress(p);
      if (p.lastResult || p.status !== "sending") {
        refresh();
      }
    });
    return unsubscribe;
  }, [id, refresh]);

  useEffect(() => {
    if (!id || !progress?.currentRecipientId) return;
    if (progress.currentRecipientId === lastPreviewedId.current) return;
    lastPreviewedId.current = progress.currentRecipientId;
    window.api.preview.renderRecipient(id, progress.currentRecipientId).then(setPreview);
  }, [id, progress?.currentRecipientId]);

  if (!campaign || !id || campaign.status === "draft") return <div className="text-muted">Loading…</div>;

  const total = progress?.total ?? campaign.totalRecipients;
  const sent = progress?.sent ?? campaign.sentCount;
  const failedCount = progress?.failed ?? campaign.failedCount;
  const skipped = progress?.skipped ?? campaign.skippedCount;
  const remaining = progress?.remaining ?? total - sent - failedCount - skipped;
  const processed = sent + failedCount;

  // Calculate ETA
  let etaLabel = "N/A";
  if (campaign.status === "sending" && remaining > 0) {
    let avgSecondsPerEmail = 2; // rough network time
    if (campaign.sendingMode === "automatic_interval" && campaign.intervalConfig) {
      avgSecondsPerEmail += (campaign.intervalConfig.minSeconds + campaign.intervalConfig.maxSeconds) / 2;
    } else if (campaign.sendingMode === "batch" && campaign.batchConfig) {
      avgSecondsPerEmail += campaign.batchConfig.pauseSeconds / campaign.batchConfig.batchSize;
    }
    const remainingSeconds = remaining * avgSecondsPerEmail;
    if (remainingSeconds < 60) {
      etaLabel = `< 1 min`;
    } else {
      etaLabel = `~${Math.ceil(remainingSeconds / 60)} min`;
    }
  } else if (remaining === 0 && total > 0) {
    etaLabel = "Done";
  }

  async function start() {
    setBusy(true);
    await window.api.sending.start(id!);
    setBusy(false);
  }
  async function pause() {
    await window.api.sending.pause(id!);
  }
  async function resume() {
    setBusy(true);
    await window.api.sending.resume(id!);
    setBusy(false);
  }
  async function stop() {
    const ok = await confirmAction("Progress is preserved and you can resume later.", {
      title: "Stop sending?",
      confirmLabel: "Stop",
      danger: true,
    });
    if (!ok) return;
    await window.api.sending.stop(id!);
  }
  async function manualSend() {
    setBusy(true);
    await window.api.sending.manualSendNext(id!);
    setBusy(false);
    await refresh();
  }
  async function manualSkip() {
    await window.api.sending.manualSkipNext(id!);
    await refresh();
  }
  async function retryAll() {
    await window.api.sending.retryFailed(id!);
    await refresh();
  }

  const isDone =
    campaign.status === "completed" ||
    campaign.status === "cancelled" ||
    campaign.status === "failed" ||
    (remaining === 0 && total > 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">
            {campaign.sendingMode === "manual" ? "Manual sending" : "Automated sending"} · Sending {processed.toLocaleString()} / {total.toLocaleString()}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div className="grid grid-5" style={{ marginBottom: 18 }}>
        <StatTile label="Total" value={total} />
        <StatTile label="Sent" value={sent} accent="success" />
        <StatTile label="Failed" value={failedCount} accent="danger" />
        <StatTile label="Remaining" value={remaining} accent="primary" />
        <StatTile label="Est. Time" value={etaLabel} />
      </div>

      <div style={{ marginBottom: 22 }}>
        <ProgressBar value={processed + skipped} max={total} />
      </div>

      {isDone ? (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Campaign finished</div>
          <p className="text-muted">
            {sent} sent, {failedCount} failed, {skipped} skipped of {total} total.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={() => navigate(`/campaigns/${id}`)}>
              View Results &amp; Export
            </button>
            {failedCount > 0 && (
              <button className="btn" onClick={retryAll}>
                Retry Failed Recipients
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          {campaign.sendingMode === "manual" ? (
            <>
              {nextManual ? (
                <>
                  <div className="hint" style={{ marginBottom: 10 }}>
                    Next recipient: <strong className="text-success">{nextManual.email}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-primary" onClick={manualSend} disabled={busy}>
                      {busy ? "Sending…" : "Send to This Recipient"}
                    </button>
                    <button className="btn" onClick={manualSkip} disabled={busy}>
                      Skip
                    </button>
                  </div>
                </>
              ) : (
                <div className="hint">No pending recipients remain.</div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              {campaign.status === "paused" || campaign.status === "ready" || campaign.status === "interrupted" ? (
                <>
                  <button className="btn btn-primary" onClick={campaign.status === "ready" ? start : resume} disabled={busy}>
                    {campaign.status === "ready" ? "Start Sending" : "Resume Sending"}
                  </button>
                  {campaign.status === "ready" && (
                    <button className="btn" onClick={async () => {
                      const email = window.prompt("Enter your email address to receive all emails in this run (Test Mode):");
                      if (!email || !email.includes("@")) return;
                      setBusy(true);
                      await window.api.sending.start(id!, { testEmail: email.trim() });
                      setBusy(false);
                    }} disabled={busy}>
                      Run as Test (Dry Run)
                    </button>
                  )}
                </>
              ) : (
                <button className="btn" onClick={pause}>
                  Pause
                </button>
              )}
              <button className="btn btn-outline-danger" onClick={stop} disabled={campaign.status !== "sending"}>
                Stop
              </button>
            </div>
          )}
        </div>
      )}

      {failed.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Failed Recipients ({failed.length})</h3>
            <button className="btn btn-sm" onClick={() => setShowFailed(true)}>
              View &amp; Retry
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>{campaign.status === "sending" ? "Live Preview — Currently Sending" : "Preview"}</h3>
          {progress?.currentRecipientEmail && <span className="hint">{progress.currentRecipientEmail}</span>}
        </div>
        <div className="card-pad">
          {preview ? (
            <EmailPreviewFrame rendered={preview} device="desktop" theme="light" />
          ) : (
            <div className="hint">No recipient is currently being processed.</div>
          )}
        </div>
      </div>

      {showFailed && (
        <Modal title="Failed Recipients" onClose={() => setShowFailed(false)} wide>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-sm" onClick={retryAll}>
              Retry All Eligible
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Reason</th>
                <th>Category</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.errorReason}</td>
                  <td className="mono">{r.failureCategory}</td>
                  <td>{r.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
