import { ipcMain } from "electron";
import { getCampaign } from "../db/campaigns.repo";
import { getTemplate } from "../db/templates.repo";
import { getSmtpProfile } from "../db/smtp.repo";
import { listRecipients, getRecipient } from "../db/recipients.repo";
import { renderRecipientEmail } from "../lib/render-email";

export function registerPreviewHandlers(): void {
  ipcMain.handle("preview:renderRecipient", (_e, campaignId: string, recipientId: string) => {
    const campaign = getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const recipient = getRecipient(recipientId);
    if (!recipient) throw new Error("Recipient not found");
    const template = campaign.templateId ? getTemplate(campaign.templateId) : null;
    const smtp = campaign.smtpProfileId ? getSmtpProfile(campaign.smtpProfileId) : null;
    return renderRecipientEmail(campaign, template, smtp, recipient);
  });

  ipcMain.handle("preview:randomSample", (_e, campaignId: string, count: number) => {
    const all = listRecipients(campaignId).filter(
      (r) => r.status !== "excluded" && r.email && r.email.trim() !== ""
    );
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  });
}
