import { useState } from "react";
import type { Campaign, ImportSummary } from "@shared/types";

export default function StepImport({
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
  const [filePath, setFilePath] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [emailColumn, setEmailColumn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndParse() {
    setError(null);
    const path = await window.api.import.pickFile();
    if (!path) return;
    setBusy(true);
    try {
      const result = await window.api.import.parse(campaign.id, path);
      setFilePath(path);
      setSummary(result);
      setEmailColumn(result.detectedEmailColumn);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function changeEmailColumn(col: string) {
    setEmailColumn(col);
    setBusy(true);
    try {
      const result = await window.api.import.recheckColumn(campaign.id, col);
      setSummary(result);
    } finally {
      setBusy(false);
    }
  }

  async function proceed() {
    if (!emailColumn) return;
    await window.api.campaigns.update(campaign.id, { columnMapping: { emailColumn } });
    await refresh();
    onNext();
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Import Recipient File</h3>
      <p className="hint">Supports .csv and .xlsx. Filter your data externally before importing — this app does not alter rows beyond what you configure here.</p>

      {error && <div className="banner banner-danger">{error}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "14px 0" }}>
        <button className="btn btn-primary" onClick={pickAndParse} disabled={busy}>
          {busy ? "Working…" : "Choose Recipient File…"}
        </button>
        {filePath && <span className="hint mono">{filePath}</span>}
        {!filePath && campaign.recipientFileName && (
          <span className="hint">Previously imported: {campaign.recipientFileName} (choose a file to re-import)</span>
        )}
      </div>

      {summary && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <div className="stat-tile">
              <div className="value">{summary.totalRows}</div>
              <div className="label">Rows</div>
            </div>
            <div className="stat-tile">
              <div className="value">{summary.totalColumns}</div>
              <div className="label">Columns</div>
            </div>
            <div className="stat-tile accent-warning">
              <div className="value">{summary.duplicateEmailCount}</div>
              <div className="label">Duplicate Emails</div>
            </div>
            <div className="stat-tile accent-danger">
              <div className="value">{summary.invalidEmailCount + summary.missingRequiredCount}</div>
              <div className="label">Invalid / Missing</div>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 18, maxWidth: 340 }}>
            <label>Email Column</label>
            <select value={emailColumn ?? ""} onChange={(e) => changeEmailColumn(e.target.value)}>
              <option value="" disabled>
                Select the column containing email addresses
              </option>
              {summary.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {summary.detectedEmailColumn && (
              <div className="hint">Auto-detected: {summary.detectedEmailColumn} — override if incorrect.</div>
            )}
          </div>

          <div className="hint" style={{ marginBottom: 8 }}>
            Preview (first {summary.preview.length} rows)
          </div>
          <div style={{ overflowX: "auto", border: "1px solid var(--border-soft)", borderRadius: 8 }}>
            <table className="data-table">
              <thead>
                <tr>
                  {summary.columns.map((c) => (
                    <th key={c} className={c === emailColumn ? "text-success" : ""}>
                      {c}
                      {c === emailColumn ? " ✓" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.preview.map((row, idx) => (
                  <tr key={idx}>
                    {summary.columns.map((c) => (
                      <td key={c}>{row[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="wizard-footer">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <button className="btn btn-primary" disabled={!summary || !emailColumn || busy} onClick={proceed}>
          Continue →
        </button>
      </div>
    </div>
  );
}
