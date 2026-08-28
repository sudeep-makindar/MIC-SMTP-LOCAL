import { useEffect, useMemo, useState } from "react";
import type { AttachmentConfig, Campaign } from "@shared/types";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function detectPlaceholdersClient(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const re = new RegExp(PLACEHOLDER_RE);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) found.add(m[1]);
  }
  return Array.from(found).sort();
}

function autoMap(placeholder: string, columns: string[]): string | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const target = normalize(placeholder);
  const exact = columns.find((c) => normalize(c) === target);
  if (exact) return exact;
  const partial = columns.find((c) => normalize(c).includes(target) || target.includes(normalize(c)));
  return partial ?? null;
}

export default function StepMapping({
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
  const [columns, setColumns] = useState<string[]>([]);
  const [templateBody, setTemplateBody] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>(campaign.placeholderMapping);
  const [attachmentConfig, setAttachmentConfig] = useState<AttachmentConfig>(campaign.attachmentConfig);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const emailColumn = campaign.columnMapping.emailColumn;
        if (!emailColumn) throw new Error("Email column not set. Go back to Import.");
        const summary = await window.api.import.recheckColumn(campaign.id, emailColumn);
        setColumns(summary.columns);
        if (campaign.templateId) {
          const t = await window.api.templates.read(campaign.templateId);
          setTemplateBody(t?.body ?? "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeholders = useMemo(
    () => detectPlaceholdersClient(campaign.subject, templateBody),
    [campaign.subject, templateBody]
  );

  useEffect(() => {
    if (columns.length === 0 || placeholders.length === 0) return;
    setMapping((prev) => {
      const next = { ...prev };
      for (const p of placeholders) {
        if (!next[p]) {
          const suggestion = autoMap(p, columns);
          if (suggestion) next[p] = suggestion;
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, placeholders]);

  const unmapped = placeholders.filter((p) => !mapping[p]);
  const canProceed = unmapped.length === 0 && loaded && !error;

  async function pickStaticFile() {
    setBusy(true);
    try {
      const filename = await window.api.recipients.pickStaticAttachment(campaign.id);
      if (filename) setAttachmentConfig({ mode: "static", staticFileName: filename });
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await window.api.import.commit({
        campaignId: campaign.id,
        columnMapping: campaign.columnMapping,
        placeholderMapping: mapping,
        attachmentConfig,
      });
      await refresh();
      onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Map Placeholders to Columns</h3>
      {error && <div className="banner banner-danger">{error}</div>}

      {placeholders.length === 0 ? (
        <div className="hint">No placeholders detected in the subject or template body.</div>
      ) : (
        <table className="data-table" style={{ marginBottom: 20 }}>
          <thead>
            <tr>
              <th>Placeholder</th>
              <th>Mapped Column</th>
            </tr>
          </thead>
          <tbody>
            {placeholders.map((p) => (
              <tr key={p}>
                <td className="mono">{`{{${p}}}`}</td>
                <td>
                  <select
                    value={mapping[p] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [p]: e.target.value }))}
                    style={{ minWidth: 220 }}
                  >
                    <option value="">— Unmapped —</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unmapped.length > 0 && (
        <div className="banner banner-danger">
          A campaign cannot send while placeholders remain unmapped: {unmapped.map((p) => `{{${p}}}`).join(", ")}
        </div>
      )}

      <div className="divider" />

      <h3>Attachments</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          className={`btn ${attachmentConfig.mode === "none" ? "btn-primary" : ""}`}
          onClick={() => setAttachmentConfig({ mode: "none" })}
        >
          None
        </button>
        <button
          className={`btn ${attachmentConfig.mode === "static" ? "btn-primary" : ""}`}
          onClick={() => setAttachmentConfig({ mode: "static", staticFileName: attachmentConfig.staticFileName ?? null })}
        >
          Static (same file for everyone)
        </button>
        <button
          className={`btn ${attachmentConfig.mode === "per_recipient" ? "btn-primary" : ""}`}
          onClick={() => setAttachmentConfig({ mode: "per_recipient", columnName: attachmentConfig.columnName ?? null })}
        >
          Per-Recipient (from column)
        </button>
      </div>

      {attachmentConfig.mode === "static" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={pickStaticFile} disabled={busy}>
            Choose File…
          </button>
          <span className="hint">{attachmentConfig.staticFileName ?? "No file selected"}</span>
        </div>
      )}

      {attachmentConfig.mode === "per_recipient" && (
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Attachment Path Column</label>
          <select
            value={attachmentConfig.columnName ?? ""}
            onChange={(e) => setAttachmentConfig({ mode: "per_recipient", columnName: e.target.value })}
          >
            <option value="">Select column…</option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="hint">Each recipient's row must contain a valid path to their file (e.g. a certificate PDF).</div>
        </div>
      )}

      <div className="wizard-footer">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <button className="btn btn-primary" disabled={!canProceed || busy} onClick={commit}>
          {busy ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
