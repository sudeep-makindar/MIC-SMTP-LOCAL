import { useEffect, useState } from "react";
import type { Campaign, Recipient, SmtpProfile, SmtpSecurity } from "@shared/types";
import type { SmtpTestResult } from "../../types/api";
import { IconPlus } from "../../components/icons";

const PROVIDER_PRESETS: { label: string; host: string; port: number; security: SmtpSecurity }[] = [
  { label: "Gmail (SSL 465)", host: "smtp.gmail.com", port: 465, security: "ssl" },
  { label: "Gmail (STARTTLS 587)", host: "smtp.gmail.com", port: 587, security: "tls" },
  { label: "Outlook / Office 365", host: "smtp.office365.com", port: 587, security: "tls" },
  { label: "Custom", host: "", port: 587, security: "tls" },
];

export default function StepSmtp({
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
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [selectedId, setSelectedId] = useState(campaign.smtpProfileId ?? "");
  const [form, setForm] = useState({ name: "", host: "", port: 465, security: "ssl" as SmtpSecurity, username: "", fromName: "", fromEmail: "" });
  const [password, setPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testEmailResult, setTestEmailResult] = useState<SmtpTestResult | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const [ccEmails, setCcEmails] = useState(campaign.ccEmails);
  const [bccEmails, setBccEmails] = useState(campaign.bccEmails);
  const [replyTo, setReplyTo] = useState(campaign.replyTo);

  // Catches the easy copy-paste mistake of swapping Host and Username —
  // a real hostname always looks like a domain (has a dot) and is never
  // identical to the login name.
  const hostLooksSuspicious =
    form.host.trim().length > 0 &&
    (!form.host.includes(".") || form.host.trim().toLowerCase() === form.username.trim().toLowerCase());

  async function loadProfiles() {
    const list = await window.api.smtp.list();
    setProfiles(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
  }

  useEffect(() => {
    loadProfiles();
    window.api.recipients.list(campaign.id).then((list) => {
      const eligible = list.filter((r) => r.status !== "excluded");
      setRecipients(eligible);
      if (eligible.length > 0) setSampleId(eligible[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null;

  function openNewProfileForm() {
    setForm({ name: "", host: "", port: 465, security: "ssl", username: "", fromName: "", fromEmail: "" });
    setEditingId(null);
    setShowNew(true);
  }

  function openEditProfileForm(profile: SmtpProfile) {
    setForm({
      name: profile.name,
      host: profile.host,
      port: profile.port,
      security: profile.security,
      username: profile.username,
      fromName: profile.fromName,
      fromEmail: profile.fromEmail,
    });
    setEditingId(profile.id);
    setShowNew(true);
  }

  async function saveProfile() {
    setBusy(true);
    try {
      const profile = await window.api.smtp.upsert(form, editingId ?? undefined);
      if (password) await window.api.smtp.setPassword(profile.id, password);
      await loadProfiles();
      setSelectedId(profile.id);
      setShowNew(false);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function applyPasswordToSelected() {
    if (!selectedProfile || !password) return;
    await window.api.smtp.setPassword(selectedProfile.id, password);
  }

  async function testConnection() {
    if (!selectedProfile) return;
    setTesting(true);
    setTestResult(null);
    try {
      if (password) await window.api.smtp.setPassword(selectedProfile.id, password);
      const result = await window.api.smtp.testConnection(selectedProfile.id);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  async function sendTestEmail() {
    if (!selectedProfile || !testEmail.trim()) return;
    setSendingTest(true);
    setTestEmailResult(null);
    try {
      const result = await window.api.smtp.sendTestEmail({
        campaignId: campaign.id,
        smtpProfileId: selectedProfile.id,
        testRecipient: testEmail.trim(),
        sampleRecipientId: sampleId,
      });
      setTestEmailResult(result);
      if (result.ok) await refresh();
    } finally {
      setSendingTest(false);
    }
  }

  async function saveAndNext() {
    if (!selectedProfile) return;
    await window.api.campaigns.update(campaign.id, {
      smtpProfileId: selectedProfile.id,
      ccEmails,
      bccEmails,
      replyTo,
    });
    await refresh();
    onNext();
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>SMTP Configuration</h3>

      <div className="field" style={{ maxWidth: 380, marginBottom: 14 }}>
        <label>SMTP Profile</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {profiles.length === 0 && <option value="">No profiles yet</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.host})
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm"
          style={{ marginTop: 8 }}
          onClick={() => (showNew ? setShowNew(false) : openNewProfileForm())}
        >
          {showNew ? "Cancel" : (<><IconPlus size={11} /> New SMTP Profile</>)}
        </button>
      </div>

      {showNew && (
        <div className="card card-pad" style={{ marginBottom: 18, background: "var(--bg-2)" }}>
          <div className="field" style={{ marginBottom: 10, maxWidth: 320 }}>
            <label>Provider Preset</label>
            <select
              onChange={(e) => {
                const preset = PROVIDER_PRESETS[Number(e.target.value)];
                if (preset) setForm((f) => ({ ...f, host: preset.host, port: preset.port, security: preset.security }));
              }}
            >
              {PROVIDER_PRESETS.map((p, idx) => (
                <option key={p.label} value={idx}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Profile Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Club Gmail" />
            </div>
            <div className="field">
              <label>Host</label>
              <input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
            </div>
          </div>
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Port</label>
              <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} />
            </div>
            <div className="field">
              <label>Security</label>
              <select value={form.security} onChange={(e) => setForm((f) => ({ ...f, security: e.target.value as SmtpSecurity }))}>
                <option value="ssl">SSL (implicit)</option>
                <option value="tls">STARTTLS</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>SMTP Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="Your email, or e.g. emailapikey for ZeptoMail"
              />
              <div className="hint">The login used to authenticate — not necessarily an email address (e.g. ZeptoMail uses the literal "emailapikey").</div>
            </div>
            <div className="field">
              <label>From Name</label>
              <input value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} placeholder="Club Events Team" />
            </div>
          </div>
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>From Email</label>
              <input
                value={form.fromEmail}
                onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
                placeholder="results@yourdomain.com"
              />
              <div className="hint">The actual sending address — must be verified with your SMTP provider. This is what recipients see and what the provider authorizes.</div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>App Password / SMTP Token</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editingId ? "Leave blank to keep using the password already set this session" : "Use a Gmail App Password, not your normal password"} />
            <div className="hint">Never stored on disk — held in memory only for this session.</div>
          </div>
          {hostLooksSuspicious && (
            <div className="banner banner-warning">
              "{form.host}" doesn't look like a real hostname — a host should look like{" "}
              <span className="mono">smtp.provider.com</span>, not match your username. Double-check Host and Username
              aren't swapped.
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={saveProfile}
            disabled={busy || !form.name || !form.host || !form.username || !form.fromEmail}
          >
            {editingId ? "Save Changes" : "Save Profile"}
          </button>
        </div>
      )}

      {selectedProfile && !showNew && (
        <div className="card card-pad" style={{ marginBottom: 18, background: "var(--bg-2)" }}>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong>{selectedProfile.name}</strong>
              <span className="hint" style={{ marginLeft: 8 }}>
                {selectedProfile.host}:{selectedProfile.port} · {selectedProfile.security.toUpperCase()} · user: {selectedProfile.username}
              </span>
            </div>
            <button className="btn btn-sm" onClick={() => openEditProfileForm(selectedProfile)}>
              Edit
            </button>
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            Sending as: <strong className="mono" style={{ color: "var(--text-0)" }}>{selectedProfile.fromName ? `${selectedProfile.fromName} <${selectedProfile.fromEmail}>` : selectedProfile.fromEmail || "(no From Email set)"}</strong>
          </div>
          <div className="field-row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ maxWidth: 280 }}>
              <label>Password / App Password (this session)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={applyPasswordToSelected} placeholder="Required to test / send" />
            </div>
            <button className="btn" onClick={testConnection} disabled={testing}>
              {testing ? "Testing…" : "Test Connection"}
            </button>
          </div>
          {testResult && (
            <div className={`banner ${testResult.ok ? "banner-info" : "banner-danger"}`} style={{ marginTop: 10 }}>
              {testResult.ok ? "SMTP connection and authentication verified." : `Connection failed: ${testResult.message}`}
            </div>
          )}
        </div>
      )}

      <div className="divider" />

      <h3>Message Headers</h3>
      <p className="hint">Optional. CC and BCC apply to every email in this campaign — use with care on large sends. Reply-To lets replies go somewhere other than the sending address.</p>
      <div className="field-row" style={{ marginBottom: 18 }}>
        <div className="field">
          <label>CC</label>
          <input value={ccEmails} onChange={(e) => setCcEmails(e.target.value)} placeholder="organizer@example.com, lead@example.com" />
        </div>
        <div className="field">
          <label>BCC</label>
          <input value={bccEmails} onChange={(e) => setBccEmails(e.target.value)} placeholder="archive@example.com" />
        </div>
        <div className="field">
          <label>Reply-To</label>
          <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@example.com" />
        </div>
      </div>

      <div className="divider" />

      <h3>Send Test Email</h3>
      <p className="hint">Generates the real personalized email using a sample recipient and sends it through your configured SMTP server.</p>
      <div className="field-row" style={{ marginBottom: 10, alignItems: "flex-end" }}>
        <div className="field">
          <label>Sample Recipient (for personalization)</label>
          <select value={sampleId ?? ""} onChange={(e) => setSampleId(e.target.value)}>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.email}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Send Test To</label>
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <button className="btn btn-primary" onClick={sendTestEmail} disabled={sendingTest || !selectedProfile || !testEmail.trim()}>
          {sendingTest ? "Sending…" : "Send Test Email"}
        </button>
      </div>
      {testEmailResult && (
        <div className={`banner ${testEmailResult.ok ? "banner-info" : "banner-danger"}`}>
          {testEmailResult.ok
            ? "Test email was accepted by the SMTP server. Check the inbox to confirm it looks correct."
            : `Test email failed: ${testEmailResult.message}`}
        </div>
      )}

      <div className="wizard-footer">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <button className="btn btn-primary" disabled={!selectedProfile} onClick={saveAndNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}
