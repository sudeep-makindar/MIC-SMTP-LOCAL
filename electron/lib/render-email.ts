import fs from "node:fs";
import path from "node:path";
import type { Campaign, Recipient, RenderedEmail, SmtpProfile, Template } from "../../shared/types";
import { renderTemplate } from "./template-engine";
import { attachmentExists, splitEmailList } from "./validators";
import { campaignAttachmentsDir } from "./paths";

/** Renders the exact personalized subject/body/attachments a recipient would receive. */
export function renderRecipientEmail(
  campaign: Campaign,
  template: Template | null,
  smtp: SmtpProfile | null,
  recipient: Recipient
): RenderedEmail {
  const missingPlaceholders = new Set<string>();

  const subjectResult = renderTemplate(campaign.subject, campaign.placeholderMapping, recipient.data);
  subjectResult.missing.forEach((m) => missingPlaceholders.add(m));

  let html: string | null = null;
  let text: string | null = null;

  if (template) {
    const bodyRaw = fs.readFileSync(template.bodyPath, "utf-8");
    const bodyResult = renderTemplate(bodyRaw, campaign.placeholderMapping, recipient.data);
    bodyResult.missing.forEach((m) => missingPlaceholders.add(m));
    if (template.type === "html") html = bodyResult.text;
    else text = bodyResult.text;
  }

  const attachments: RenderedEmail["attachments"] = [];
  if (campaign.attachmentConfig.mode === "static" && campaign.attachmentConfig.staticFileName) {
    const p = path.join(campaignAttachmentsDir(campaign.id), campaign.attachmentConfig.staticFileName);
    attachments.push({ name: campaign.attachmentConfig.staticFileName, path: p, exists: attachmentExists(p) });
  } else if (campaign.attachmentConfig.mode === "per_recipient" && campaign.attachmentConfig.columnName) {
    const rawPath = recipient.data[campaign.attachmentConfig.columnName];
    if (rawPath && rawPath.trim() !== "") {
      attachments.push({ name: path.basename(rawPath), path: rawPath, exists: attachmentExists(rawPath) });
    }
  }

  return {
    subject: subjectResult.text,
    html,
    text,
    from: smtp ? `${smtp.fromName ? smtp.fromName + " " : ""}<${smtp.fromEmail}>` : "",
    to: recipient.email,
    cc: splitEmailList(campaign.ccEmails),
    bcc: splitEmailList(campaign.bccEmails),
    replyTo: campaign.replyTo?.trim() ? campaign.replyTo.trim() : null,
    attachments,
    missingPlaceholders: Array.from(missingPlaceholders),
  };
}
