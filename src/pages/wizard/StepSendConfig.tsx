import { useState } from "react";
import type { Campaign, SendingMode } from "@shared/types";

const MODES: { key: SendingMode; label: string; desc: string }[] = [
  { key: "manual", label: "Manual", desc: "You explicitly send or skip each recipient, one at a time." },
  { key: "automatic", label: "Automatic", desc: "Sends the full queue sequentially, back-to-back." },
  { key: "automatic_interval", label: "Automatic + Interval", desc: "Sends sequentially with a randomized delay between messages." },
  { key: "batch", label: "Batch", desc: "Sends in fixed-size batches with a pause between each batch." },
];

export default function StepSendConfig({
  campaign,
  refresh,
  onNext,
  onBack,
}: {
  campaign: Campaign;
  refresh: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<SendingMode>(campaign.sendingMode);
  const [interval, setInterval_] = useState(campaign.intervalConfig);
  const [batch, setBatch] = useState(campaign.batchConfig);
  const [busy, setBusy] = useState(false);

  const intervalValid = interval.minSeconds >= 1 && interval.maxSeconds >= interval.minSeconds;
  const batchValid = batch.batchSize >= 1 && batch.pauseSeconds >= 0;

  async function saveAndNext() {
    setBusy(true);
    await window.api.campaigns.update(campaign.id, {
      sendingMode: mode,
      intervalConfig: interval,
      batchConfig: batch,
    });
    setBusy(false);
    await refresh();
    onNext();
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Sending Mode</h3>
      <p className="hint">Controls how quickly and how manually messages go out. The operator can pause, resume, or stop at any time.</p>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {MODES.map((m) => (
          <div
            key={m.key}
            className="card card-pad"
            style={{
              cursor: "pointer",
              borderColor: mode === m.key ? "var(--accent)" : undefined,
              background: mode === m.key ? "var(--accent-bg)" : undefined,
            }}
            onClick={() => setMode(m.key)}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.label}</div>
            <div className="text-muted" style={{ fontSize: 12.5 }}>
              {m.desc}
            </div>
          </div>
        ))}
      </div>

      {mode === "automatic_interval" && (
        <div style={{ marginBottom: 24, maxWidth: 500, background: "var(--surface-0)", padding: 20, borderRadius: 8, border: "1px solid var(--border)" }}>
          <h4 style={{ marginTop: 0, marginBottom: 16 }}>Delay Between Emails</h4>
          <div className="field" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Minimum Delay: <strong>{interval.minSeconds}s</strong></label>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={interval.minSeconds}
              onChange={(e) => setInterval_((c) => ({ ...c, minSeconds: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Maximum Delay: <strong>{interval.maxSeconds}s</strong></label>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={interval.maxSeconds}
              onChange={(e) => setInterval_((c) => ({ ...c, maxSeconds: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            To avoid spam filters, emails will be sent with a random delay between {interval.minSeconds} and {interval.maxSeconds} seconds.
          </p>
        </div>
      )}
      {mode === "automatic_interval" && !intervalValid && (
        <div className="banner banner-danger" style={{ marginBottom: 20 }}>Max delay must be greater than or equal to min delay.</div>
      )}

      {mode === "batch" && (
        <div style={{ marginBottom: 24, maxWidth: 500, background: "var(--surface-0)", padding: 20, borderRadius: 8, border: "1px solid var(--border)" }}>
          <h4 style={{ marginTop: 0, marginBottom: 16 }}>Batch Configuration</h4>
          <div className="field" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Batch Size: <strong>{batch.batchSize} emails</strong></label>
            </div>
            <input
              type="range"
              min={1}
              max={500}
              value={batch.batchSize}
              onChange={(e) => setBatch((c) => ({ ...c, batchSize: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Pause Between Batches: <strong>{batch.pauseSeconds}s</strong></label>
            </div>
            <input
              type="range"
              min={0}
              max={600}
              step={10}
              value={batch.pauseSeconds}
              onChange={(e) => setBatch((c) => ({ ...c, pauseSeconds: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
        </div>
      )}

      <div className="wizard-footer">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || (mode === "automatic_interval" && !intervalValid) || (mode === "batch" && !batchValid)}
          onClick={saveAndNext}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
