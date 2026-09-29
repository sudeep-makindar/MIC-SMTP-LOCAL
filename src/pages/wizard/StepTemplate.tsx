import { useEffect, useState } from "react";
import type { Campaign, Template } from "@shared/types";
import { ImportTemplateModal } from "../Templates";
import { IconUpload } from "../../components/icons";

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
  const [showImport, setShowImport] = useState<"bulk" | "single" | null>(null);

  async function loadTemplates(selectNewest = false) {
    const list = await window.api.templates.list();
    setTemplates(list);
    if (selectNewest && list.length > 0) {
      setTemplateId(list[0].id);
    }
  }

  useEffect(() => {
    loadTemplates();
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
        {subject.includes("{{") ? (
          <div className="hint" style={{ marginTop: 8, padding: "8px 12px", background: "var(--surface-0)", borderRadius: 6, border: "1px solid var(--border)" }}>
            <strong>Preview:</strong> {
              subject.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, p1) => {
                const lower = p1.toLowerCase();
                if (lower.includes("name")) return "John Doe";
                if (lower.includes("event")) return "Annual Summit";
                if (lower.includes("date")) return "Oct 24th";
                if (lower.includes("company") || lower.includes("org")) return "Acme Corp";
                return `[${p1}]`;
              })
            }
          </div>
        ) : (
          <div className="hint">Supports placeholders like {"{{name}}"} — mapped in a later step.</div>
        )}
      </div>

      <div className="divider" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Select Template</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setShowImport("bulk")}>
            <IconUpload size={12} /> Bulk Import…
          </button>
          <button className="btn btn-sm" onClick={() => setShowImport("single")}>
            Import from File…
          </button>
        </div>
      </div>
      {templates.length === 0 ? (
        <div className="banner banner-warning">
          No templates available yet. Click <strong>Bulk Import…</strong> or <strong>Import from File…</strong> above to import your HDB or HTML templates.
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

      {showImport && (
        <ImportTemplateModal
          initialMode={showImport}
          onClose={() => setShowImport(null)}
          onImported={() => {
            setShowImport(null);
            loadTemplates(true);
          }}
        />
      )}
    </div>
  );
}
