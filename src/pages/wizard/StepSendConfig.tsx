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
        <div className="field-row" style={{ marginBottom: 14, maxWidth: 420 }}>
          <div className="field">
            <label>Min Interval (seconds)</label>
            <input
              type="number"
              min={1}
              value={interval.minSeconds}
              onChange={(e) => setInterval_((c) => ({ ...c, minSeconds: Number(e.target.value) }))}
            />
          </div>
          <div className="field">
            <label>Max Interval (seconds)</label>
            <input
              type="number"
              min={1}
              value={interval.maxSeconds}
              onChange={(e) => setInterval_((c) => ({ ...c, maxSeconds: Number(e.target.value) }))}
            />
          </div>
        </div>
      )}
      {mode === "automatic_interval" && !intervalValid && (
        <div className="banner banner-danger">Max interval must be greater than or equal to min interval, both at least 1 second.</div>
      )}

      {mode === "batch" && (
        <div className="field-row" style={{ marginBottom: 14, maxWidth: 420 }}>
          <div className="field">
            <label>Batch Size</label>
            <input
              type="number"
              min={1}
              value={batch.batchSize}
              onChange={(e) => setBatch((c) => ({ ...c, batchSize: Number(e.target.value) }))}
            />
          </div>
          <div className="field">
            <label>Pause Between Batches (seconds)</label>
            <input
              type="number"
              min={0}
              value={batch.pauseSeconds}
              onChange={(e) => setBatch((c) => ({ ...c, pauseSeconds: Number(e.target.value) }))}
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
