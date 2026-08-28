import { useEffect, useState } from "react";
import type { Campaign, PreviewDevice, PreviewTheme, Recipient, RenderedEmail } from "@shared/types";
import EmailPreviewFrame from "../../components/EmailPreviewFrame";
import { IconShuffle } from "../../components/icons";

const DEVICE_MODES: { device: PreviewDevice; theme: PreviewTheme; label: string }[] = [
  { device: "desktop", theme: "light", label: "Desktop Light" },
  { device: "desktop", theme: "dark", label: "Desktop Dark" },
  { device: "android", theme: "light", label: "Android Light" },
  { device: "android", theme: "dark", label: "Android Dark" },
  { device: "ios", theme: "light", label: "iOS Light" },
  { device: "ios", theme: "dark", label: "iOS Dark" },
];

export default function StepPreview({
  campaign,
  onNext,
  onBack,
}: {
  campaign: Campaign;
  onNext: () => void;
  onBack: () => void;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rendered, setRendered] = useState<RenderedEmail | null>(null);
  const [modeIdx, setModeIdx] = useState(0);
  const [sample, setSample] = useState<Recipient[]>([]);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.recipients.list(campaign.id).then((list) => {
      const eligible = list.filter((r) => r.status !== "excluded");
      setRecipients(eligible);
      if (eligible.length > 0) setSelectedId(eligible[0].id);
    });
  }, [campaign.id]);

  useEffect(() => {
    if (!selectedId) return;
    setBusy(true);
    window.api.preview
      .renderRecipient(campaign.id, selectedId)
      .then(setRendered)
      .finally(() => setBusy(false));
  }, [selectedId, campaign.id]);

  async function loadRandomSample() {
    const picked = await window.api.preview.randomSample(campaign.id, 10);
    setSample(picked);
    setSampleIdx(0);
    if (picked.length > 0) setSelectedId(picked[0].id);
  }

  function cycleSample(delta: number) {
    if (sample.length === 0) return;
    const next = (sampleIdx + delta + sample.length) % sample.length;
    setSampleIdx(next);
    setSelectedId(sample[next].id);
  }

  const mode = DEVICE_MODES[modeIdx];

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Preview Personalized Emails</h3>
      <p className="hint">This renders the exact content each recipient would receive — not the raw template.</p>

      <div className="field-row" style={{ marginBottom: 16, alignItems: "flex-end" }}>
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Recipient</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setSample([]);
            }}
          >
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.email}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" onClick={loadRandomSample}>
          <IconShuffle size={13} /> Preview Random 10
        </button>
        {sample.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-sm" onClick={() => cycleSample(-1)}>
              ← Prev
            </button>
            <span className="hint">
              Sample {sampleIdx + 1} / {sample.length}
            </span>
            <button className="btn btn-sm" onClick={() => cycleSample(1)}>
              Next →
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {DEVICE_MODES.map((m, idx) => (
          <button
            key={m.label}
            className={`btn btn-sm ${idx === modeIdx ? "btn-primary" : ""}`}
            onClick={() => setModeIdx(idx)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {rendered && !busy ? (
        <>
          {rendered.missingPlaceholders.length > 0 && (
            <div className="banner banner-danger">
              Missing values for this recipient: {rendered.missingPlaceholders.map((p) => `{{${p}}}`).join(", ")}
            </div>
          )}
          {rendered.attachments.some((a) => !a.exists) && (
            <div className="banner banner-danger">One or more attachments for this recipient could not be found.</div>
          )}
          <EmailPreviewFrame rendered={rendered} device={mode.device} theme={mode.theme} />
        </>
      ) : (
        <div className="hint">Rendering preview…</div>
      )}

      <div className="wizard-footer">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}
