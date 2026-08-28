import { ipcMain } from "electron";
import * as repo from "../db/smtp.repo";
import { getCampaign } from "../db/campaigns.repo";
import { getTemplate } from "../db/templates.repo";
import { listRecipients } from "../db/recipients.repo";
import * as creds from "../lib/credential-store";
import { verifyConnection, buildTransport, sendMail } from "../lib/smtp-client";
import { renderRecipientEmail } from "../lib/render-email";
import { updateCampaign } from "../db/campaigns.repo";
import type { SmtpProfileInput } from "../db/smtp.repo";

export function registerSmtpHandlers(): void {
  ipcMain.handle("smtp:list", () => repo.listSmtpProfiles());

  ipcMain.handle("smtp:upsert", (_e, input: SmtpProfileInput, id?: string) => repo.upsertSmtpProfile(input, id));

  ipcMain.handle("smtp:delete", (_e, id: string) => {
    creds.clearPassword(id);
    repo.deleteSmtpProfile(id);
  });

  ipcMain.handle("smtp:setPassword", (_e, id: string, password: string) => {
    creds.setPassword(id, password);
  });

  ipcMain.handle("smtp:hasPassword", (_e, id: string) => creds.hasPassword(id));

  ipcMain.handle("smtp:testConnection", async (_e, id: string) => {
    const profile = repo.getSmtpProfile(id);
    if (!profile) return { ok: false, category: "other" as const, message: "SMTP profile not found" };
    const password = creds.getPassword(id);
    if (!password) return { ok: false, category: "auth_failure" as const, message: "No password set for this session" };
    return verifyConnection(profile, password);
  });

  ipcMain.handle(
    "smtp:sendTestEmail",
    async (_e, params: { campaignId: string; smtpProfileId: string; testRecipient: string; sampleRecipientId: string | null }) => {
      const profile = repo.getSmtpProfile(params.smtpProfileId);
      if (!profile) throw new Error("SMTP profile not found");
      const password = creds.getPassword(params.smtpProfileId);
      if (!password) throw new Error("SMTP password not set for this session");

      const campaign = getCampaign(params.campaignId);
      if (!campaign) throw new Error("Campaign not found");
      const template = campaign.templateId ? getTemplate(campaign.templateId) : null;

      let recipient = params.sampleRecipientId
        ? listRecipients(params.campaignId).find((r) => r.id === params.sampleRecipientId)
        : listRecipients(params.campaignId)[0];

      if (!recipient) {
        recipient = {
          id: "sample",
          campaignId: params.campaignId,
          rowIndex: 0,
          data: {},
          email: params.testRecipient,
          status: "pending",
          attachmentPath: null,
          errorReason: null,
          failureCategory: null,
          attempts: 0,
          lastAttemptAt: null,
          sentAt: null,
          isDuplicate: false,
          isExcludedRecent: false,
        };
      }

      const rendered = renderRecipientEmail(campaign, template, profile, recipient);
      const transport = buildTransport(profile, password);
      try {
        // CC/BCC are deliberately left out of test sends — a test email
        // should never accidentally reach real cc'd/bcc'd people. Reply-To
        // is harmless to include since it has no effect until someone replies.
        const result = await sendMail(transport, {
          from: rendered.from,
          to: params.testRecipient,
          replyTo: rendered.replyTo,
          subject: `[TEST] ${rendered.subject}`,
          html: rendered.html,
          text: rendered.text,
          attachments: rendered.attachments.filter((a) => a.exists).map((a) => ({ filename: a.name, path: a.path })),
        });
        if (result.ok) {
          updateCampaign(params.campaignId, { testEmailSentAt: new Date().toISOString() });
        }
        return result;
      } finally {
        transport.close();
      }
    }
  );
}
