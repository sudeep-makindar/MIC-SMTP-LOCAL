import { useEffect, useState } from "react";
import type { Campaign, Template } from "@shared/types";

export default function StepTemplate({
  campaign,
  refresh,
  onNext,
}: {
  campaign: Campaign;
  refresh: () => Promise<void>;
  onNext: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(campaign.templateId ?? "");
  const [subject, setSubject] = useState(campaign.subject);
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.templates.list().then(setTemplates);
  }, []);

  const canProceed = templateId && subject.trim() && name.trim();

  async function saveAndNext() {
    setSaving(true);
    await window.api.campaigns.update(campaign.id, {
      name: name.trim(),
      description,
      templateId,
      subject: subject.trim(),
    });
    setSaving(false);
    await refresh();
    onNext();
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Campaign Details</h3>
      <div className="field-row" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Campaign Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Internal notes" />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Email Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Your certificate for {{event_name}}"
        />
        <div className="hint">Supports placeholders like {"{{name}}"} — mapped in a later step.</div>
      </div>

      <div className="divider" />

      <h3>Select Template</h3>
      {templates.length === 0 ? (
        <div className="banner banner-warning">
          No templates available. Go to the Templates page to import an HTML or plain-text template first.
        </div>
      ) : (
        <div className="grid grid-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="card card-pad"
              style={{
                cursor: "pointer",
                borderColor: templateId === t.id ? "var(--accent)" : undefined,
                background: templateId === t.id ? "var(--accent-bg)" : undefined,
              }}
              onClick={() => setTemplateId(t.id)}
            >
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div className="text-muted" style={{ fontSize: 11.5, textTransform: "uppercase", marginTop: 2 }}>
                {t.type === "html" ? "HTML" : "Plain Text"}
              </div>
              <div className="tag-list" style={{ marginTop: 10 }}>
                {t.placeholders.slice(0, 4).map((p) => (
                  <span className="tag" key={p}>{`{{${p}}}`}</span>
                ))}
                {t.placeholders.length > 4 && <span className="tag">+{t.placeholders.length - 4} more</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="wizard-footer">
        <div />
        <button className="btn btn-primary" disabled={!canProceed || saving} onClick={saveAndNext}>
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
