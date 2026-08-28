import { useEffect, useState } from "react";
import type { Campaign, PreflightReport } from "@shared/types";
import Modal from "../../components/Modal";

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const CHECKLIST_LABELS = [
  "Template selected",
  "Subject verified",
  "Recipient file imported",
  "Email column mapped",
  "Placeholders mapped",
  "Duplicate check completed",
  "Invalid email check completed",
  "Attachments validated",
  "Random previews reviewed",
  "Test email sent",
  "SMTP verified",
];

export default function StepPreflight({
  campaign,
  refresh,
  onBack,
  onConfirmed,
}: {
  campaign: Campaign;
  refresh: () => Promise<void>;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewedPreviews, setReviewedPreviews] = useState(false);
  const [duplicateDecision, setDuplicateDecision] = useState<"exclude" | "keep" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [senderDisplay, setSenderDisplay] = useState("—");
  const [pendingCount, setPendingCount] = useState(0);

  async function run() {
    setLoading(true);
    const [r, recipients] = await Promise.all([window.api.preflight.run(campaign.id), window.api.recipients.list(campaign.id)]);
    setReport(r);
    // The actual number of emails that will go out is whatever is still
    // "pending" right now — not a formula derived from the report, since
    // that can't know whether duplicates were kept or excluded.
    setPendingCount(recipients.filter((rec) => rec.status === "pending").length);
    setLoading(false);
  }

  useEffect(() => {
    run();
    if (campaign.smtpProfileId) {
      window.api.smtp.list().then((profiles) => {
        const p = profiles.find((x) => x.id === campaign.smtpProfileId);
        if (p) setSenderDisplay(`${p.fromName ? p.fromName + " " : ""}<${p.fromEmail}>`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excludeDuplicates() {
    await window.api.recipients.excludeDuplicates(campaign.id);
    setDuplicateDecision("exclude");
    await run();
  }

  function keepDuplicates() {
    setDuplicateDecision("keep");
  }

  async function excludeRecent() {
    await window.api.recipients.excludeRecent(campaign.id, 24);
    await run();
  }

  async function excludeInvalid() {
    const list = await window.api.recipients.list(campaign.id);
    const badIds = list
      .filter((r) => r.status !== "excluded")
      .filter((r) => !r.email.trim() || !EMAIL_RE.test(r.email.trim()))
      .map((r) => r.id);
    if (badIds.length === 0) return;
    await window.api.recipients.exclude(badIds);
    await run();
  }

  const remainingCount = pendingCount;
  const isLarge = remainingCount > 500;
  const invalidOrMissingCount = report
    ? report.summary.invalid + (report.items.find((i) => i.id === "missing_emails")?.count ?? 0)
    : 0;

  const estimatedDuration = estimateDuration(campaign, report?.summary.valid ?? 0);

  const duplicatesResolved = !report || report.summary.duplicates === 0 || duplicateDecision !== null;
  const checklistDone = !!report && !report.hasCriticalErrors && reviewedPreviews && duplicatesResolved;

  async function confirmSend() {
    setBusy(true);
    try {
      await window.api.campaigns.update(campaign.id, { status: "ready" });
      await refresh();
      onConfirmed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Preflight Check</h3>
      <p className="hint">Every condition that could cause an avoidable sending error is checked here.</p>

      {loading && <div className="hint">Running preflight checks…</div>}

      {report && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-tile">
              <div className="value">{report.summary.imported}</div>
              <div className="label">Imported</div>
            </div>
            <div className="stat-tile">
              <div className="value">{report.summary.unique}</div>
              <div className="label">Unique</div>
            </div>
            <div className="stat-tile accent-success">
              <div className="value">{report.summary.valid}</div>
              <div className="label">Valid</div>
            </div>
            <div className="stat-tile accent-danger">
              <div className="value">{report.summary.invalid}</div>
              <div className="label">Invalid</div>
            </div>
            <div className="stat-tile accent-warning">
              <div className="value">{report.summary.duplicates}</div>
              <div className="label">Duplicates</div>
            </div>
            <div className="stat-tile accent-success">
              <div className="value">{report.summary.attachmentsValid}</div>
              <div className="label">Attachments Valid</div>
            </div>
            <div className="stat-tile accent-danger">
              <div className="value">{report.summary.missingValues}</div>
              <div className="label">Missing Values</div>
            </div>
            <div className="stat-tile accent-warning">
              <div className="value">{report.summary.recentlyContacted}</div>
              <div className="label">Recently Contacted</div>
            </div>
          </div>

          {report.summary.duplicates > 0 && (
            <div className="banner banner-info" style={{ alignItems: "flex-start" }}>
              <div>
                <strong>{report.summary.duplicates} recipient(s) share an email with another row.</strong> If that's
                accidental (a spreadsheet row copied twice), exclude them. If it's intentional — e.g. the same person
                applied to multiple departments and should get a separate, differently personalized email for
                each — keep them. Nothing sends until you choose one.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
            {report.summary.duplicates > 0 && (
              <>
                <button
                  className={`btn btn-sm ${duplicateDecision === "exclude" ? "btn-primary" : ""}`}
                  onClick={excludeDuplicates}
                >
                  Exclude {report.summary.duplicates} Duplicate(s)
                </button>
                <button
                  className={`btn btn-sm ${duplicateDecision === "keep" ? "btn-primary" : ""}`}
                  onClick={keepDuplicates}
                >
                  Keep All — Send Separately
                </button>
                {duplicateDecision && (
                  <span className="text-success" style={{ fontSize: 12 }}>
                    ✓ {duplicateDecision === "keep" ? "Keeping duplicates as intentional, separate sends" : "Duplicates excluded"}
                  </span>
                )}
              </>
            )}
            {invalidOrMissingCount > 0 && (
              <button className="btn btn-sm" onClick={excludeInvalid}>
                Exclude {invalidOrMissingCount} Invalid / Missing Email(s)
              </button>
            )}
            {report.summary.recentlyContacted > 0 && (
              <button className="btn btn-sm" onClick={excludeRecent}>
                Exclude {report.summary.recentlyContacted} Recently Contacted
              </button>
            )}
            <button className="btn btn-sm" onClick={run}>
              ↻ Re-run Preflight
            </button>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Detailed Checks</h3>
            </div>
            <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {report.items.map((item) => (
                <div className="checklist-item" key={item.id}>
                  <span className={`check-dot ${item.severity}`}>
                    {item.severity === "passed" ? "✓" : item.severity === "warning" ? "!" : "✕"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{item.label}</span>
                    <span className="text-muted"> — {item.detail}</span>
                  </div>
                  <span className={`badge badge-${item.severity}`}>{item.severity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Final Checklist</h3>
            </div>
            <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {CHECKLIST_LABELS.map((label) => {
                const auto = evaluateChecklistItem(label, campaign, report, duplicateDecision);
                const isManual = label === "Random previews reviewed";
                const done = isManual ? reviewedPreviews : auto;
                return (
                  <label className="checklist-item" key={label} style={{ cursor: isManual ? "pointer" : "default" }}>
                    {isManual ? (
                      <input type="checkbox" checked={reviewedPreviews} onChange={(e) => setReviewedPreviews(e.target.checked)} />
                    ) : (
                      <span className={`check-dot ${done ? "passed" : "critical"}`}>{done ? "✓" : "✕"}</span>
                    )}
                    <span>{label}</span>
                    {label === "Duplicate check completed" && report.summary.duplicates > 0 && (
                      <span className="text-muted" style={{ marginLeft: "auto", fontSize: 11.5 }}>
                        {duplicateDecision === "exclude" && "Excluded"}
                        {duplicateDecision === "keep" && "Kept intentionally — sending as separate emails"}
                        {!duplicateDecision && "Awaiting your decision below"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {report.hasCriticalErrors && (
            <div className="banner banner-danger">Critical errors must be resolved before this campaign can send.</div>
          )}

          <div className="wizard-footer">
            <button className="btn" onClick={onBack}>
              ← Back
            </button>
            <button className="btn btn-primary" disabled={!checklistDone} onClick={() => setShowConfirm(true)}>
              Review &amp; Confirm Send →
            </button>
          </div>
        </>
      )}

      {showConfirm && report && (
        <Modal
          title="Confirm Campaign Send"
          onClose={() => setShowConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={busy || (isLarge && confirmText !== "SEND")}
                onClick={confirmSend}
              >
                {busy ? "Preparing…" : "Confirm & Prepare Send"}
              </button>
            </>
          }
        >
          <p>
            You are about to send <strong>{remainingCount}</strong> emails.
          </p>
          <table className="data-table">
            <tbody>
              <tr>
                <td>Sender</td>
                <td className="mono">{senderDisplay}</td>
              </tr>
              <tr>
                <td>Subject</td>
                <td>{campaign.subject}</td>
              </tr>
              <tr>
                <td>Recipient Count</td>
                <td>{remainingCount}</td>
              </tr>
              <tr>
                <td>Sending Mode</td>
                <td>{campaign.sendingMode}</td>
              </tr>
              {campaign.sendingMode === "automatic_interval" && (
                <tr>
                  <td>Interval</td>
                  <td>
                    {campaign.intervalConfig.minSeconds}–{campaign.intervalConfig.maxSeconds}s between messages
                  </td>
                </tr>
              )}
              {campaign.sendingMode === "batch" && (
                <tr>
                  <td>Batch</td>
                  <td>
                    {campaign.batchConfig.batchSize} per batch, {campaign.batchConfig.pauseSeconds}s pause
                  </td>
                </tr>
              )}
              <tr>
                <td>Attachments</td>
                <td>{campaign.attachmentConfig.mode === "none" ? "None" : campaign.attachmentConfig.mode}</td>
              </tr>
              {campaign.ccEmails.trim() && (
                <tr>
                  <td>CC</td>
                  <td>{campaign.ccEmails}</td>
                </tr>
              )}
              {campaign.bccEmails.trim() && (
                <tr>
                  <td>BCC</td>
                  <td>{campaign.bccEmails}</td>
                </tr>
              )}
              {campaign.replyTo.trim() && (
                <tr>
                  <td>Reply-To</td>
                  <td>{campaign.replyTo}</td>
                </tr>
              )}
              <tr>
                <td>Estimated Duration</td>
                <td>{estimatedDuration}</td>
              </tr>
            </tbody>
          </table>
          {isLarge && (
            <div style={{ marginTop: 16 }}>
              <div className="banner banner-warning">
                This is a large campaign. Type <strong>SEND</strong> below to confirm.
              </div>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type SEND to confirm" style={{ marginTop: 8, width: "100%" }} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function evaluateChecklistItem(
  label: string,
  campaign: Campaign,
  report: PreflightReport,
  duplicateDecision: "exclude" | "keep" | null
): boolean {
  switch (label) {
    case "Template selected":
      return !!campaign.templateId;
    case "Subject verified":
      return !!campaign.subject.trim();
    case "Recipient file imported":
      return !!campaign.recipientFileName;
    case "Email column mapped":
      return !!campaign.columnMapping.emailColumn;
    case "Placeholders mapped":
      return !report.items.find((i) => i.id === "placeholder_mapping" && i.severity === "critical");
    case "Duplicate check completed":
      return report.summary.duplicates === 0 || duplicateDecision !== null;
    case "Invalid email check completed":
      return !report.items.find((i) => i.id === "invalid_emails" && i.severity === "critical");
    case "Attachments validated":
      return !report.items.find((i) => i.id === "attachments" && i.severity === "critical");
    case "Test email sent":
      return !!campaign.testEmailSentAt;
    case "SMTP verified":
      return report.summary.smtpVerified;
    default:
      return false;
  }
}

function estimateDuration(campaign: Campaign, count: number): string {
  let seconds = 0;
  if (campaign.sendingMode === "manual") return "Operator-paced (manual)";
  if (campaign.sendingMode === "automatic") seconds = count * 1.5;
  if (campaign.sendingMode === "automatic_interval") {
    const avg = (campaign.intervalConfig.minSeconds + campaign.intervalConfig.maxSeconds) / 2;
    seconds = count * (avg + 1);
  }
  if (campaign.sendingMode === "batch") {
    const batches = Math.ceil(count / Math.max(1, campaign.batchConfig.batchSize));
    seconds = count * 1.5 + batches * campaign.batchConfig.pauseSeconds;
  }
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
  return `~${(seconds / 3600).toFixed(1)} hr`;
}
