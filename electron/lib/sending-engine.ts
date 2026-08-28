import { EventEmitter } from "node:events";
import type { Transporter } from "nodemailer";
import type { Campaign, Recipient, SendProgress, FailureCategory } from "../../shared/types";
import { getCampaign, updateCampaign } from "../db/campaigns.repo";
import { getTemplate } from "../db/templates.repo";
import { getSmtpProfile } from "../db/smtp.repo";
import { getPendingRecipients, updateRecipient, recomputeCampaignStats, getRecipient } from "../db/recipients.repo";
import { appendLogEntry } from "../db/sendlog.repo";
import { getPassword } from "./credential-store";
import { buildTransport, sendMail } from "./smtp-client";
import { renderRecipientEmail } from "./render-email";

export const PERMANENT_FAILURE_CATEGORIES: FailureCategory[] = ["invalid_recipient", "attachment_failure"];

export function isPermanentFailure(category: FailureCategory | null): boolean {
  return !!category && PERMANENT_FAILURE_CATEGORIES.includes(category);
}

type EngineState = "idle" | "running" | "paused" | "stopped";

class CampaignSendingEngine extends EventEmitter {
  campaignId: string;
  state: EngineState = "idle";
  private transport: Transporter | null = null;
  private abortSleep: (() => void) | null = null;
  private currentRecipientId: string | null = null;

  constructor(campaignId: string) {
    super();
    this.campaignId = campaignId;
  }

  private emitProgress(overrides: Partial<SendProgress> = {}) {
    const campaign = getCampaign(this.campaignId)!;
    const stats = recomputeCampaignStats(this.campaignId);
    const remaining = stats.total - stats.sent - stats.failed - stats.skipped;
    const progress: SendProgress = {
      campaignId: this.campaignId,
      total: stats.total,
      sent: stats.sent,
      failed: stats.failed,
      skipped: stats.skipped,
      remaining,
      currentRecipientId: this.currentRecipientId,
      currentRecipientEmail: this.currentRecipientId ? getRecipient(this.currentRecipientId)?.email ?? null : null,
      status: campaign.status,
      lastResult: null,
      ...overrides,
    };
    this.emit("progress", progress);
  }

  private ensureTransport(): Transporter {
    if (this.transport) return this.transport;
    const campaign = getCampaign(this.campaignId)!;
    if (!campaign.smtpProfileId) throw new Error("No SMTP profile configured for this campaign.");
    const profile = getSmtpProfile(campaign.smtpProfileId);
    if (!profile) throw new Error("SMTP profile not found.");
    const password = getPassword(profile.id);
    if (!password) throw new Error("SMTP credentials not available in this session. Please re-enter SMTP password.");
    this.transport = buildTransport(profile, password);
    return this.transport;
  }

  private closeTransport() {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
  }

  private async sleepInterruptible(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const chunk = 200;
      let waited = 0;
      const tick = () => {
        if ((this.state as EngineState) !== "running") {
          resolve();
          return;
        }
        waited += chunk;
        if (waited >= ms) {
          resolve();
          return;
        }
        timer = setTimeout(tick, chunk);
      };
      let timer = setTimeout(tick, Math.min(chunk, ms));
      this.abortSleep = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  private async sendOne(campaign: Campaign, recipient: Recipient, attemptNumber: number): Promise<void> {
    this.currentRecipientId = recipient.id;
    updateRecipient(recipient.id, { status: "sending" });
    this.emitProgress();

    const template = campaign.templateId ? getTemplate(campaign.templateId) : null;
    const profile = campaign.smtpProfileId ? getSmtpProfile(campaign.smtpProfileId) : null;
    const rendered = renderRecipientEmail(campaign, template, profile, recipient);

    const nowIso = new Date().toISOString();

    if (rendered.missingPlaceholders.length > 0) {
      updateRecipient(recipient.id, {
        status: "failed",
        errorReason: `Missing values for: ${rendered.missingPlaceholders.join(", ")}`,
        failureCategory: "other",
        attempts: attemptNumber,
        lastAttemptAt: nowIso,
      });
      this.logResult(campaign, recipient, "failed", `Missing values for: ${rendered.missingPlaceholders.join(", ")}`, "other", attemptNumber);
      return;
    }

    const missingAttachment = rendered.attachments.find((a) => !a.exists);
    if (missingAttachment) {
      updateRecipient(recipient.id, {
        status: "failed",
        errorReason: `Attachment not found: ${missingAttachment.name}`,
        failureCategory: "attachment_failure",
        attempts: attemptNumber,
        lastAttemptAt: nowIso,
      });
      this.logResult(campaign, recipient, "failed", `Attachment not found: ${missingAttachment.name}`, "attachment_failure", attemptNumber);
      return;
    }

    try {
      const transport = this.ensureTransport();
      const result = await sendMail(transport, {
        from: rendered.from,
        to: rendered.to,
        cc: rendered.cc,
        bcc: rendered.bcc,
        replyTo: rendered.replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: rendered.attachments.map((a) => ({ filename: a.name, path: a.path })),
      });

      if (result.ok) {
        updateRecipient(recipient.id, { status: "sent", attempts: attemptNumber, lastAttemptAt: nowIso, sentAt: nowIso, errorReason: null });
        this.logResult(campaign, recipient, "sent", null, null, attemptNumber);
      } else {
        updateRecipient(recipient.id, {
          status: "failed",
          errorReason: result.message ?? "Send failed",
          failureCategory: result.category ?? "other",
          attempts: attemptNumber,
          lastAttemptAt: nowIso,
        });
        this.logResult(campaign, recipient, "failed", result.message ?? "Send failed", result.category ?? "other", attemptNumber);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRecipient(recipient.id, {
        status: "failed",
        errorReason: message,
        failureCategory: "other",
        attempts: attemptNumber,
        lastAttemptAt: nowIso,
      });
      this.logResult(campaign, recipient, "failed", message, "other", attemptNumber);
    }
  }

  private logResult(
    campaign: Campaign,
    recipient: Recipient,
    status: "sent" | "failed",
    reason: string | null,
    category: FailureCategory | null,
    attemptNumber: number
  ) {
    const template = campaign.templateId ? getTemplate(campaign.templateId) : null;
    const profile = campaign.smtpProfileId ? getSmtpProfile(campaign.smtpProfileId) : null;
    appendLogEntry({
      campaignId: campaign.id,
      campaignName: campaign.name,
      sender: profile ? profile.fromEmail : "",
      recipient: recipient.email,
      subject: campaign.subject,
      status,
      failureReason: reason,
      failureCategory: category,
      attemptNumber,
      template: template?.name ?? null,
      attachmentInfo: campaign.attachmentConfig.mode !== "none" ? campaign.attachmentConfig.mode : null,
      sendingMode: campaign.sendingMode,
    });
    this.currentRecipientId = null;
    this.emitProgress({
      lastResult: { recipientId: recipient.id, email: recipient.email, status, reason },
    });
  }

  async runAutomatic(): Promise<void> {
    this.state = "running";
    updateCampaign(this.campaignId, { status: "sending", startedAt: getCampaign(this.campaignId)!.startedAt ?? new Date().toISOString() });
    try {
      let queue = getPendingRecipients(this.campaignId);
      let processedInBatch = 0;
      let attemptCounter = 1;
      while (queue.length > 0) {
        if ((this.state as EngineState) !== "running") break;
        const recipient = queue.shift()!;
        const existing = getRecipient(recipient.id);
        const attemptNumber = (existing?.attempts ?? 0) + 1;
        await this.sendOne(getCampaign(this.campaignId)!, recipient, attemptNumber);
        processedInBatch++;

        if ((this.state as EngineState) !== "running") break;

        const campaign = getCampaign(this.campaignId)!;
        if (campaign.sendingMode === "automatic_interval") {
          const { minSeconds, maxSeconds } = campaign.intervalConfig;
          const delayMs = (minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds)) * 1000;
          await this.sleepInterruptible(delayMs);
        } else if (campaign.sendingMode === "batch") {
          if (processedInBatch >= campaign.batchConfig.batchSize && queue.length > 0) {
            processedInBatch = 0;
            await this.sleepInterruptible(campaign.batchConfig.pauseSeconds * 1000);
          }
        }
      }
    } finally {
      this.closeTransport();
      const finalCampaign = getCampaign(this.campaignId)!;
      const stats = recomputeCampaignStats(this.campaignId);
      const remaining = stats.total - stats.sent - stats.failed - stats.skipped;
      if ((this.state as EngineState) === "running") {
        // Queue drained naturally.
        updateCampaign(this.campaignId, {
          status: remaining > 0 ? "interrupted" : "completed",
          completedAt: remaining > 0 ? null : new Date().toISOString(),
        });
        this.state = "idle";
      } else if ((this.state as EngineState) === "paused" || (this.state as EngineState) === "stopped") {
        updateCampaign(this.campaignId, { status: "paused" });
      }
      this.emitProgress();
      void finalCampaign;
    }
  }

  async sendManualOne(recipientId: string): Promise<void> {
    const campaign = getCampaign(this.campaignId)!;
    const recipient = getRecipient(recipientId);
    if (!recipient) throw new Error("Recipient not found");
    updateCampaign(this.campaignId, { status: "sending", startedAt: campaign.startedAt ?? new Date().toISOString() });
    const attemptNumber = (recipient.attempts ?? 0) + 1;
    await this.sendOne(campaign, recipient, attemptNumber);
    this.closeTransport();
    const stats = recomputeCampaignStats(this.campaignId);
    const remaining = stats.total - stats.sent - stats.failed - stats.skipped;
    updateCampaign(this.campaignId, { status: remaining > 0 ? "paused" : "completed", completedAt: remaining > 0 ? null : new Date().toISOString() });
    this.emitProgress();
  }

  skipManualOne(recipientId: string): void {
    updateRecipient(recipientId, { status: "skipped" });
    recomputeCampaignStats(this.campaignId);
    this.emitProgress();
  }

  pause(): void {
    if (this.state === "running") {
      this.state = "paused";
      this.abortSleep?.();
    }
  }

  stop(): void {
    this.state = "stopped";
    this.abortSleep?.();
  }
}

const engines = new Map<string, CampaignSendingEngine>();

export function getEngine(campaignId: string): CampaignSendingEngine {
  let engine = engines.get(campaignId);
  if (!engine) {
    engine = new CampaignSendingEngine(campaignId);
    engines.set(campaignId, engine);
  }
  return engine;
}

export function removeEngine(campaignId: string): void {
  engines.delete(campaignId);
}

export type { CampaignSendingEngine };
