import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Campaign } from "@shared/types";
import StatusBadge from "../components/StatusBadge";
import StepTemplate from "./wizard/StepTemplate";
import StepImport from "./wizard/StepImport";
import StepMapping from "./wizard/StepMapping";
import StepPreview from "./wizard/StepPreview";
import StepSmtp from "./wizard/StepSmtp";
import StepSendConfig from "./wizard/StepSendConfig";
import StepPreflight from "./wizard/StepPreflight";

const STEPS = [
  { key: "template", label: "Template & Subject" },
  { key: "import", label: "Import Recipients" },
  { key: "mapping", label: "Map Columns" },
  { key: "preview", label: "Preview" },
  { key: "smtp", label: "SMTP & Test Email" },
  { key: "sendconfig", label: "Sending Mode" },
  { key: "preflight", label: "Preflight & Confirm" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export default function CampaignWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [step, setStep] = useState<StepKey>("template");
  const [maxStepReached, setMaxStepReached] = useState(0);

  const refresh = useCallback(async () => {
    if (!id) return;
    const c = await window.api.campaigns.get(id);
    setCampaign(c);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!campaign || !id) {
    return <div className="text-muted">Loading campaign…</div>;
  }

  function goTo(key: StepKey) {
    const idx = STEPS.findIndex((s) => s.key === key);
    if (idx <= maxStepReached) setStep(key);
  }

  function next() {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) {
      const nextIdx = idx + 1;
      setMaxStepReached((m) => Math.max(m, nextIdx));
      setStep(STEPS[nextIdx].key);
    }
  }

  function back() {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">{campaign.description || "No description"}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div className="wizard-steps">
        {STEPS.map((s, idx) => (
          <div
            key={s.key}
            className={`wizard-step ${s.key === step ? "active" : ""} ${idx < maxStepReached ? "done" : ""}`}
            onClick={() => goTo(s.key)}
          >
            <span className="num">{idx < maxStepReached ? "✓" : idx + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      <div className="card card-pad">
        {step === "template" && <StepTemplate campaign={campaign} refresh={refresh} onNext={next} />}
        {step === "import" && <StepImport campaign={campaign} refresh={refresh} onNext={next} onBack={back} />}
        {step === "mapping" && <StepMapping campaign={campaign} refresh={refresh} onNext={next} onBack={back} />}
        {step === "preview" && <StepPreview campaign={campaign} onNext={next} onBack={back} />}
        {step === "smtp" && <StepSmtp campaign={campaign} refresh={refresh} onNext={next} onBack={back} />}
        {step === "sendconfig" && <StepSendConfig campaign={campaign} refresh={refresh} onNext={next} onBack={back} />}
        {step === "preflight" && (
          <StepPreflight
            campaign={campaign}
            refresh={refresh}
            onBack={back}
            onConfirmed={() => navigate(`/campaigns/${campaign.id}/send`)}
          />
        )}
      </div>
    </div>
  );
}
