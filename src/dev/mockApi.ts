// Dev-only in-browser mock of the Electron preload API (window.api), so the
// full UI can be driven and inspected in a plain browser tab where no real
// preload/IPC bridge exists. Never used in the packaged app — Electron's
// preload always defines window.api before this check runs.
import type {
  Campaign,
  Recipient,
  Template,
  SmtpProfile,
  ImportSummary,
  PreflightReport,
  SendProgress,
  RenderedEmail,
  SendLogEntry,
  CampaignStatus,
} from "@shared/types";
import type { Api, SmtpTestResult } from "../types/api";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function nowIso() {
  return new Date().toISOString();
}

const templates: Template[] = [
  {
    id: "tpl-cert",
    name: "Event Certificate",
    type: "html",
    bodyPath: "mock://cert.html",
    assetsPath: null,
    placeholders: ["name", "event_name", "certificate_id"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "tpl-reminder",
    name: "Event Reminder",
    type: "text",
    bodyPath: "mock://reminder.txt",
    assetsPath: null,
    placeholders: ["name", "event_name"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const templateBodies: Record<string, string> = {
  "tpl-cert": `<div style="font-family:sans-serif">
  <h1 style="color:#111">Certificate of Participation</h1>
  <p>Dear {{name}},</p>
  <p>This certifies your participation in <strong>{{event_name}}</strong>.</p>
  <p>Certificate ID: <code>{{certificate_id}}</code></p>
  <p>— The Organizing Committee</p>
</div>`,
  "tpl-reminder": `Hi {{name}},\n\nJust a reminder that {{event_name}} is coming up soon. We look forward to seeing you there!\n\nBest,\nThe Team`,
};

const smtpProfiles: SmtpProfile[] = [
  {
    id: "smtp-1",
    name: "Club Gmail",
    host: "smtp.gmail.com",
    port: 465,
    security: "ssl",
    username: "club.events@gmail.com",
    fromName: "Club Events Team",
    fromEmail: "club.events@gmail.com",
  },
];
const smtpPasswords = new Set<string>();

let campaigns: Campaign[] = [
  {
    id: "camp-1",
    name: "GLITCHCON Certificates",
    description: "Participation certificates for GLITCHCON 2026",
    status: "draft",
    templateId: "tpl-cert",
    subject: "Your certificate for {{event_name}}, {{name}}!",
    recipientFileName: "glitchcon_attendees.csv",
    columnMapping: { emailColumn: "Email Address" },
    placeholderMapping: { name: "Full Name", event_name: "Event Name", certificate_id: "Certificate ID" },
    attachmentConfig: { mode: "none" },
    sendingMode: "automatic_interval",
    intervalConfig: { minSeconds: 3, maxSeconds: 8 },
    batchConfig: { batchSize: 50, pauseSeconds: 60 },
    smtpProfileId: "smtp-1",
    testEmailSentAt: null,
    ccEmails: "",
    bccEmails: "",
    replyTo: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    startedAt: null,
    completedAt: null,
    totalRecipients: 6,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
  },
  {
    id: "camp-2",
    name: "Volunteer Thank You",
    description: "Post-event thank you note to volunteers",
    status: "completed",
    templateId: "tpl-reminder",
    subject: "Thank you for volunteering at {{event_name}}",
    recipientFileName: "volunteers.xlsx",
    columnMapping: { emailColumn: "Email" },
    placeholderMapping: { name: "Name", event_name: "Event Name" },
    attachmentConfig: { mode: "none" },
    sendingMode: "automatic",
    intervalConfig: { minSeconds: 3, maxSeconds: 8 },
    batchConfig: { batchSize: 50, pauseSeconds: 60 },
    smtpProfileId: "smtp-1",
    testEmailSentAt: nowIso(),
    ccEmails: "",
    bccEmails: "",
    replyTo: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    startedAt: nowIso(),
    completedAt: nowIso(),
    totalRecipients: 42,
    sentCount: 40,
    failedCount: 2,
    skippedCount: 0,
  },
];

const sampleRows = [
  { "Full Name": "Rahul Sharma", "Email Address": "rahul@example.com", "Event Name": "GLITCHCON", "Certificate ID": "CERT-001" },
  { "Full Name": "Priya Verma", "Email Address": "priya@example.com", "Event Name": "GLITCHCON", "Certificate ID": "CERT-002" },
  { "Full Name": "Amit Kumar", "Email Address": "amit@example.com", "Event Name": "GLITCHCON", "Certificate ID": "CERT-003" },
  { "Full Name": "Sara Iyer", "Email Address": "sara@example.com", "Event Name": "GLITCHCON", "Certificate ID": "CERT-004" },
  { "Full Name": "Bad Row", "Email Address": "not-an-email", "Event Name": "GLITCHCON", "Certificate ID": "CERT-005" },
  { "Full Name": "Dup Row", "Email Address": "rahul@example.com", "Event Name": "GLITCHCON", "Certificate ID": "CERT-006" },
];

let recipients: Record<string, Recipient[]> = {
  "camp-1": sampleRows.map((data, idx) => ({
    id: `r-${idx}`,
    campaignId: "camp-1",
    rowIndex: idx,
    data,
    email: data["Email Address"],
    status: "pending",
    attachmentPath: null,
    errorReason: null,
    failureCategory: null,
    attempts: 0,
    lastAttemptAt: null,
    sentAt: null,
    isDuplicate: idx === 5,
    isExcludedRecent: false,
  })),
  "camp-2": [],
};

const sendLog: SendLogEntry[] = [
  {
    id: uid(),
    timestamp: nowIso(),
    campaignId: "camp-2",
    campaignName: "Volunteer Thank You",
    sender: "club.events@gmail.com",
    recipient: "rahul@example.com",
    subject: "Thank you for volunteering at GLITCHCON",
    status: "sent",
    failureReason: null,
    failureCategory: null,
    attemptNumber: 1,
    template: "Event Reminder",
    attachmentInfo: null,
    sendingMode: "automatic",
  },
  {
    id: uid(),
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    campaignId: "camp-2",
    campaignName: "Volunteer Thank You",
    sender: "club.events@gmail.com",
    recipient: "priya@example.com",
    subject: "Thank you for volunteering at GLITCHCON",
    status: "failed",
    failureReason: "Connection timed out",
    failureCategory: "timeout",
    attemptNumber: 1,
    template: "Event Reminder",
    attachmentInfo: null,
    sendingMode: "automatic",
  },
];

function findCampaign(id: string): Campaign {
  const c = campaigns.find((x) => x.id === id);
  if (!c) throw new Error("Campaign not found: " + id);
  return c;
}

function renderMock(campaign: Campaign, recipient: Recipient): RenderedEmail {
  const template = templates.find((t) => t.id === campaign.templateId) ?? null;
  const smtp = smtpProfiles.find((p) => p.id === campaign.smtpProfileId) ?? null;
  const missing: string[] = [];
  const replace = (text: string) =>
    text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, ph: string) => {
      const col = campaign.placeholderMapping[ph];
      const val = col ? recipient.data[col] : undefined;
      if (!val) {
        missing.push(ph);
        return "";
      }
      return val;
    });
  const subject = replace(campaign.subject);
  const bodyRaw = template ? templateBodies[template.id] ?? "" : "";
  const body = replace(bodyRaw);
  return {
    subject,
    html: template?.type === "html" ? body : null,
    text: template?.type === "text" ? body : null,
    from: smtp ? `${smtp.fromName} <${smtp.fromEmail}>` : "",
    to: recipient.email,
    cc: campaign.ccEmails ? campaign.ccEmails.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
    bcc: campaign.bccEmails ? campaign.bccEmails.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
    replyTo: campaign.replyTo?.trim() || null,
    attachments: [],
    missingPlaceholders: Array.from(new Set(missing)),
  };
}

type ProgressCb = (p: SendProgress) => void;
const progressListeners = new Set<ProgressCb>();
let sendTimer: number | null = null;

function emitProgress(campaign: Campaign, currentId: string | null, lastResult: SendProgress["lastResult"]) {
  const list = recipients[campaign.id] ?? [];
  const sent = list.filter((r) => r.status === "sent").length;
  const failed = list.filter((r) => r.status === "failed").length;
  const skipped = list.filter((r) => r.status === "skipped" || r.status === "excluded").length;
  const progress: SendProgress = {
    campaignId: campaign.id,
    total: list.length,
    sent,
    failed,
    skipped,
    remaining: list.length - sent - failed - skipped,
    currentRecipientId: currentId,
    currentRecipientEmail: currentId ? list.find((r) => r.id === currentId)?.email ?? null : null,
    status: campaign.status,
    lastResult,
  };
  progressListeners.forEach((cb) => cb(progress));
}

function runAutomaticMock(campaignId: string) {
  const campaign = findCampaign(campaignId);
  campaign.status = "sending";
  const step = () => {
    const c = findCampaign(campaignId);
    if (c.status !== "sending") return;
    const list = recipients[campaignId] ?? [];
    const next = list.find((r) => r.status === "pending");
    if (!next) {
      c.status = "completed";
      c.completedAt = nowIso();
      emitProgress(c, null, null);
      return;
    }
    emitProgress(c, next.id, null);
    sendTimer = window.setTimeout(() => {
      const ok = next.email.includes("@") && next.email !== "not-an-email";
      next.status = ok ? "sent" : "failed";
      next.errorReason = ok ? null : "Invalid recipient address";
      next.failureCategory = ok ? null : "invalid_recipient";
      next.attempts += 1;
      next.sentAt = ok ? nowIso() : null;
      emitProgress(c, null, { recipientId: next.id, email: next.email, status: next.status, reason: next.errorReason });
      step();
    }, 900);
  };
  step();
}

export function createMockApi(): Api {
  return {
    campaigns: {
      list: async () => [...campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      get: async (id) => campaigns.find((c) => c.id === id) ?? null,
      create: async (name, description) => {
        const c: Campaign = {
          id: uid(),
          name,
          description,
          status: "draft",
          templateId: null,
          subject: "",
          recipientFileName: null,
          columnMapping: { emailColumn: null },
          placeholderMapping: {},
          attachmentConfig: { mode: "none" },
          sendingMode: "automatic_interval",
          intervalConfig: { minSeconds: 3, maxSeconds: 8 },
          batchConfig: { batchSize: 50, pauseSeconds: 60 },
          smtpProfileId: null,
          testEmailSentAt: null,
          ccEmails: "",
          bccEmails: "",
          replyTo: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          startedAt: null,
          completedAt: null,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        };
        campaigns.push(c);
        recipients[c.id] = [];
        return c;
      },
      update: async (id, update) => {
        const c = findCampaign(id);
        Object.assign(c, update, { updatedAt: nowIso() });
        return c;
      },
      delete: async (id) => {
        campaigns = campaigns.filter((c) => c.id !== id);
        delete recipients[id];
      },
      clone: async (id) => {
        const c = findCampaign(id);
        const copy: Campaign = {
          ...c,
          id: uid(),
          name: `${c.name} (Copy)`,
          status: "draft",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          startedAt: null,
          completedAt: null,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        };
        campaigns.push(copy);
        recipients[copy.id] = [];
        return copy;
      },
      listInterrupted: async () => [],
      recipientStats: async (id) => {
        const list = recipients[id] ?? [];
        return {
          total: list.length,
          sent: list.filter((r) => r.status === "sent").length,
          failed: list.filter((r) => r.status === "failed").length,
          skipped: list.filter((r) => r.status === "skipped" || r.status === "excluded").length,
          pending: list.filter((r) => r.status === "pending").length,
        };
      },
    },
    templates: {
      list: async () => [...templates],
      read: async (id) => {
        const t = templates.find((x) => x.id === id);
        return t ? { ...t, body: templateBodies[id] ?? "" } : null;
      },
      pickHtmlFile: async () => "C:\\fake\\template.html",
      pickTextFile: async () => "C:\\fake\\template.txt",
      pickBulkFiles: async () => [
        "C:\\fake\\welcome_template.hdb",
        "C:\\fake\\monthly_statement.hdb",
      ],
      pickFolder: async () => [
        "C:\\fake\\folder\\newsletter.hdb",
        "C:\\fake\\folder\\receipt.html",
      ],
      pickAssetsFolder: async () => "C:\\fake\\assets",
      import: async (params) => {
        const t: Template = {
          id: uid(),
          name: params.name,
          type: params.type,
          bodyPath: "mock://" + params.name,
          assetsPath: params.assetsFolderPath,
          placeholders: ["name", "event_name"],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        templates.push(t);
        templateBodies[t.id] = params.type === "html" ? "<p>Hello {{name}}, see you at {{event_name}}!</p>" : "Hello {{name}}, see you at {{event_name}}!";
        return t;
      },
      bulkImport: async (items) => {
        const created: Template[] = [];
        for (const item of items) {
          const t: Template = {
            id: uid(),
            name: item.name,
            type: item.type,
            bodyPath: "mock://" + item.name,
            assetsPath: item.assetsFolderPath ?? null,
            placeholders: ["name", "event_name"],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          templates.push(t);
          templateBodies[t.id] = item.type === "html" ? `<p>Hello {{name}}, welcome to ${item.name}!</p>` : `Hello {{name}}, welcome to ${item.name}!`;
          created.push(t);
        }
        return created;
      },
      save: async (params) => {
        const detected = Array.from(new Set(Array.from(params.body.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)).map((m) => m[1])));
        if (params.id) {
          const t = templates.find((x) => x.id === params.id);
          if (!t) throw new Error("Template not found");
          t.name = params.name;
          t.placeholders = detected;
          t.updatedAt = nowIso();
          templateBodies[params.id] = params.body;
          return t;
        }
        const t: Template = {
          id: uid(),
          name: params.name,
          type: params.type,
          bodyPath: "mock://" + params.name,
          assetsPath: null,
          placeholders: detected,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        templates.push(t);
        templateBodies[t.id] = params.body;
        return t;
      },
      delete: async (id) => {
        const idx = templates.findIndex((t) => t.id === id);
        if (idx >= 0) templates.splice(idx, 1);
      },
    },
    import: {
      pickFile: async () => "C:\\fake\\recipients.csv",
      parse: async (_campaignId, _filePath) => {
        const columns = Object.keys(sampleRows[0]);
        return {
          totalRows: sampleRows.length,
          totalColumns: columns.length,
          columns,
          preview: sampleRows.slice(0, 10),
          detectedEmailColumn: "Email Address",
          duplicateEmailCount: 1,
          invalidEmailCount: 1,
          missingRequiredCount: 0,
        } satisfies ImportSummary;
      },
      recheckColumn: async (_campaignId, emailColumn) => {
        const columns = Object.keys(sampleRows[0]);
        return {
          totalRows: sampleRows.length,
          totalColumns: columns.length,
          columns,
          preview: sampleRows.slice(0, 10),
          detectedEmailColumn: emailColumn,
          duplicateEmailCount: 1,
          invalidEmailCount: 1,
          missingRequiredCount: 0,
        } satisfies ImportSummary;
      },
      commit: async (params) => {
        const c = findCampaign(params.campaignId);
        c.columnMapping = params.columnMapping;
        c.placeholderMapping = params.placeholderMapping;
        c.attachmentConfig = params.attachmentConfig;
        c.recipientFileName = "recipients.csv";
        recipients[c.id] = sampleRows.map((data, idx) => ({
          id: `${c.id}-r${idx}`,
          campaignId: c.id,
          rowIndex: idx,
          data,
          email: data["Email Address"],
          status: "pending",
          attachmentPath: null,
          errorReason: null,
          failureCategory: null,
          attempts: 0,
          lastAttemptAt: null,
          sentAt: null,
          isDuplicate: idx === 5,
          isExcludedRecent: false,
        }));
        c.totalRecipients = recipients[c.id].length;
      },
    },
    recipients: {
      list: async (campaignId) => recipients[campaignId] ?? [],
      excludeDuplicates: async (campaignId) => {
        (recipients[campaignId] ?? []).forEach((r) => {
          if (r.isDuplicate) r.status = "excluded";
        });
      },
      excludeRecent: async () => {},
      exclude: async (ids) => {
        Object.values(recipients).forEach((list) => list.forEach((r) => { if (ids.includes(r.id)) r.status = "excluded"; }));
      },
      pickStaticAttachment: async () => "certificate_template.pdf",
    },
    smtp: {
      list: async () => [...smtpProfiles],
      upsert: async (input, id) => {
        if (id) {
          const p = smtpProfiles.find((x) => x.id === id)!;
          Object.assign(p, input);
          return p;
        }
        const p: SmtpProfile = { id: uid(), ...input };
        smtpProfiles.push(p);
        return p;
      },
      delete: async (id) => {
        const idx = smtpProfiles.findIndex((p) => p.id === id);
        if (idx >= 0) smtpProfiles.splice(idx, 1);
      },
      setPassword: async (id) => {
        smtpPasswords.add(id);
      },
      hasPassword: async (id) => smtpPasswords.has(id),
      testConnection: async (id): Promise<SmtpTestResult> => {
        if (!smtpPasswords.has(id)) return { ok: false, category: "auth_failure", message: "No password set for this session" };
        return { ok: true };
      },
      sendTestEmail: async (params): Promise<SmtpTestResult> => {
        const c = findCampaign(params.campaignId);
        c.testEmailSentAt = nowIso();
        return { ok: true, messageId: "mock-message-id" };
      },
    },
    preview: {
      renderRecipient: async (campaignId, recipientId) => {
        const c = findCampaign(campaignId);
        const r = (recipients[campaignId] ?? []).find((x) => x.id === recipientId);
        if (!r) throw new Error("Recipient not found");
        return renderMock(c, r);
      },
      randomSample: async (campaignId, count) => {
        const list = (recipients[campaignId] ?? []).filter((r) => r.status !== "excluded");
        return [...list].sort(() => Math.random() - 0.5).slice(0, count);
      },
    },
    preflight: {
      run: async (campaignId): Promise<PreflightReport> => {
        const c = findCampaign(campaignId);
        const list = (recipients[campaignId] ?? []).filter((r) => r.status !== "excluded");
        const dupes = list.filter((r) => r.isDuplicate).length;
        const invalid = list.filter((r) => !r.email.includes("@")).length;
        return {
          items: [
            { id: "recipient_count", label: "Recipient count", severity: "passed", detail: `${list.length} recipients imported`, count: list.length },
            { id: "duplicates", label: "Duplicate recipients", severity: dupes ? "warning" : "passed", detail: dupes ? `${dupes} duplicate email(s) detected — still included and will be sent unless you exclude them below` : "No duplicates" },
            { id: "invalid_emails", label: "Invalid email addresses", severity: invalid ? "critical" : "passed", detail: invalid ? `${invalid} invalid email(s)` : "All valid" },
            { id: "template", label: "Template validity", severity: c.templateId ? "passed" : "critical", detail: c.templateId ? "Template OK" : "No template selected" },
            { id: "subject", label: "Subject line", severity: c.subject ? "passed" : "critical", detail: c.subject ? "Subject set" : "Subject empty" },
            { id: "placeholder_mapping", label: "Placeholder mapping", severity: "passed", detail: "All placeholders mapped" },
            { id: "smtp", label: "SMTP connection & authentication", severity: c.smtpProfileId ? "passed" : "critical", detail: c.smtpProfileId ? "Verified" : "No SMTP profile" },
            { id: "test_email", label: "Test email sent", severity: c.testEmailSentAt ? "passed" : "warning", detail: c.testEmailSentAt ? "Sent" : "Not sent yet" },
          ],
          hasCriticalErrors: invalid > 0 || !c.templateId || !c.subject || !c.smtpProfileId,
          summary: {
            imported: list.length,
            unique: list.length - dupes,
            valid: list.length - dupes - invalid,
            invalid,
            duplicates: dupes,
            attachmentsValid: 0,
            attachmentsMissing: 0,
            missingValues: 0,
            recentlyContacted: 0,
            smtpVerified: !!c.smtpProfileId,
            testEmailSent: !!c.testEmailSentAt,
          },
        };
      },
    },
    sending: {
      start: async (campaignId) => {
        runAutomaticMock(campaignId);
        return { started: true };
      },
      pause: async (campaignId) => {
        findCampaign(campaignId).status = "paused";
        if (sendTimer) window.clearTimeout(sendTimer);
      },
      stop: async (campaignId) => {
        findCampaign(campaignId).status = "paused";
        if (sendTimer) window.clearTimeout(sendTimer);
      },
      resume: async (campaignId) => {
        runAutomaticMock(campaignId);
        return { started: true };
      },
      getNextPending: async (campaignId) => (recipients[campaignId] ?? []).find((r) => r.status === "pending") ?? null,
      manualSendNext: async (campaignId) => {
        const next = (recipients[campaignId] ?? []).find((r) => r.status === "pending");
        if (!next) return { done: true };
        next.status = "sent";
        next.sentAt = nowIso();
        next.attempts += 1;
        const c = findCampaign(campaignId);
        emitProgress(c, null, { recipientId: next.id, email: next.email, status: "sent", reason: null });
        return { done: false };
      },
      manualSkipNext: async (campaignId) => {
        const next = (recipients[campaignId] ?? []).find((r) => r.status === "pending");
        if (!next) return { done: true };
        next.status = "skipped";
        return { done: false };
      },
      retryFailed: async (campaignId) => {
        (recipients[campaignId] ?? []).forEach((r) => {
          if (r.status === "failed") r.status = "pending";
        });
      },
      cancel: async (campaignId) => {
        findCampaign(campaignId).status = "cancelled";
      },
      onProgress: (cb) => {
        progressListeners.add(cb);
        return () => progressListeners.delete(cb);
      },
    },
    logs: {
      search: async (filters) => {
        return sendLog.filter((e) => {
          if (filters.email && !e.recipient.includes(filters.email)) return false;
          if (filters.status && e.status !== filters.status) return false;
          if (filters.subject && !e.subject.toLowerCase().includes(filters.subject.toLowerCase())) return false;
          return true;
        });
      },
      recipientHistory: async (email) => sendLog.filter((e) => e.recipient === email),
      masterStats: async () => ({
        totalSent: sendLog.filter((e) => e.status === "sent").length,
        totalFailed: sendLog.filter((e) => e.status === "failed").length,
      }),
      exportCampaign: async () => ({ path: "C:\\fake\\export.csv", sharedPath: "C:\\fake\\exports\\export.csv" }),
    },
    dashboard: {
      stats: async () => {
        const active = campaigns.find((c) => c.status === "sending" || c.status === "paused") ?? null;
        return {
          totalCampaigns: campaigns.length,
          activeCampaign: active,
          recentCampaigns: [...campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
          interruptedCount: campaigns.filter((c) => c.status === "interrupted").length,
          totalSent: sendLog.filter((e) => e.status === "sent").length,
          totalFailed: sendLog.filter((e) => e.status === "failed").length,
        };
      },
    },
    backup: {
      create: async () => ({ path: "C:\\fake\\backups\\backup_mock" }),
      list: async () => [{ name: "backup_mock", path: "C:\\fake\\backups\\backup_mock", manifest: { createdAt: nowIso(), appVersion: "0.1.0", campaignIds: [], templateIds: [] } }],
      pickFolder: async () => "C:\\fake\\backups\\backup_mock",
      restore: async () => ({ restored: true, dataRoot: "C:\\fake\\data" }),
    },
    recovery: {
      check: async () => [],
      decide: async (campaignId) => findCampaign(campaignId),
    },
    settings: {
      get: async () => null,
      set: async () => {},
      dataRoot: async () => "C:\\fake\\data",
      openDataFolder: async () => {},
    },
  };
}

export function installMockApiIfNeeded(): void {
  if (typeof window !== "undefined" && !window.api) {
    window.api = createMockApi();
    // eslint-disable-next-line no-console
    console.warn("[dev] window.api not found — installed in-browser mock backend for UI preview.");
  }
}
