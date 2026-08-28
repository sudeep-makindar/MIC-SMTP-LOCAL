import type { Campaign, PreflightReport, PreflightCheckItem } from "../../shared/types";
import { listRecipients } from "../db/recipients.repo";
import { getTemplate } from "../db/templates.repo";
import { getSmtpProfile } from "../db/smtp.repo";
import { getRecentlyContactedEmails } from "../db/sendlog.repo";
import { getPassword } from "./credential-store";
import { verifyConnection } from "./smtp-client";
import { renderRecipientEmail } from "./render-email";
import { detectPlaceholders } from "./template-engine";
import { isValidEmail, splitEmailList } from "./validators";
import fs from "node:fs";

export async function runPreflight(campaign: Campaign, opts: { checkSmtp: boolean; recentHours: number } = { checkSmtp: true, recentHours: 24 }): Promise<PreflightReport> {
  const items: PreflightCheckItem[] = [];
  const recipients = listRecipients(campaign.id).filter((r) => r.status !== "excluded");
  const imported = recipients.length;

  const seen = new Set<string>();
  let duplicates = 0;
  let invalid = 0;
  let missingEmail = 0;
  for (const r of recipients) {
    const key = r.email.trim().toLowerCase();
    if (!key) {
      missingEmail++;
      continue;
    }
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  }
  for (const r of recipients) {
    if (r.email && !isValidEmail(r.email)) invalid++;
  }
  const unique = seen.size;
  const valid = Math.max(0, unique - invalid);

  items.push({
    id: "recipient_count",
    label: "Recipient count",
    severity: imported === 0 ? "critical" : "passed",
    detail: `${imported} recipients imported`,
    count: imported,
  });

  items.push({
    id: "duplicates",
    label: "Duplicate recipients",
    severity: duplicates > 0 ? "warning" : "passed",
    detail:
      duplicates > 0
        ? `${duplicates} duplicate email(s) detected — still included and will be sent unless you exclude them below`
        : "No duplicate emails",
    count: duplicates,
  });

  items.push({
    id: "invalid_emails",
    label: "Invalid email addresses",
    severity: invalid > 0 ? "critical" : "passed",
    detail: invalid > 0 ? `${invalid} invalid email address(es) found` : "All email addresses valid",
    count: invalid,
  });

  items.push({
    id: "missing_emails",
    label: "Missing email addresses",
    severity: missingEmail > 0 ? "critical" : "passed",
    detail: missingEmail > 0 ? `${missingEmail} row(s) missing an email address` : "No missing email addresses",
    count: missingEmail,
  });

  // Template validity
  const template = campaign.templateId ? getTemplate(campaign.templateId) : null;
  if (!template) {
    items.push({ id: "template", label: "Template validity", severity: "critical", detail: "No template selected" });
  } else if (!fs.existsSync(template.bodyPath)) {
    items.push({ id: "template", label: "Template validity", severity: "critical", detail: "Template file is missing on disk" });
  } else {
    items.push({ id: "template", label: "Template validity", severity: "passed", detail: `Using template "${template.name}"` });
  }

  // Subject validity
  items.push({
    id: "subject",
    label: "Subject line",
    severity: campaign.subject.trim() ? "passed" : "critical",
    detail: campaign.subject.trim() ? "Subject line is set" : "Subject line is empty",
  });

  // CC / BCC / Reply-To format
  const ccList = splitEmailList(campaign.ccEmails);
  const bccList = splitEmailList(campaign.bccEmails);
  const invalidHeaderEmails = [...ccList, ...bccList].filter((e) => !isValidEmail(e));
  if (campaign.replyTo?.trim() && !isValidEmail(campaign.replyTo.trim())) {
    invalidHeaderEmails.push(campaign.replyTo.trim());
  }
  if (ccList.length > 0 || bccList.length > 0 || campaign.replyTo?.trim()) {
    items.push({
      id: "message_headers",
      label: "CC / BCC / Reply-To",
      severity: invalidHeaderEmails.length > 0 ? "critical" : "passed",
      detail:
        invalidHeaderEmails.length > 0
          ? `Invalid address(es): ${invalidHeaderEmails.join(", ")}`
          : `${ccList.length} CC, ${bccList.length} BCC${campaign.replyTo?.trim() ? `, reply-to ${campaign.replyTo.trim()}` : ""}`,
    });
  }

  // Placeholder mapping completeness
  const bodyText = template && fs.existsSync(template.bodyPath) ? fs.readFileSync(template.bodyPath, "utf-8") : "";
  const allPlaceholders = detectPlaceholders(campaign.subject, bodyText);
  const unmapped = allPlaceholders.filter((p) => !campaign.placeholderMapping[p]);
  items.push({
    id: "placeholder_mapping",
    label: "Placeholder mapping",
    severity: unmapped.length > 0 ? "critical" : "passed",
    detail: unmapped.length > 0 ? `Unmapped placeholders: ${unmapped.join(", ")}` : "All placeholders mapped",
    count: unmapped.length,
  });

  // Missing placeholder values + attachments, computed by rendering every recipient
  let missingValues = 0;
  let attachmentsMissing = 0;
  let attachmentsValid = 0;
  const smtp = campaign.smtpProfileId ? getSmtpProfile(campaign.smtpProfileId) : null;
  if (unmapped.length === 0 && template) {
    for (const r of recipients) {
      const rendered = renderRecipientEmail(campaign, template, smtp, r);
      if (rendered.missingPlaceholders.length > 0) missingValues++;
      for (const a of rendered.attachments) {
        if (a.exists) attachmentsValid++;
        else attachmentsMissing++;
      }
    }
  }
  items.push({
    id: "missing_values",
    label: "Missing placeholder values",
    severity: missingValues > 0 ? "critical" : "passed",
    detail: missingValues > 0 ? `${missingValues} recipient(s) missing required values` : "No missing values",
    count: missingValues,
  });

  if (campaign.attachmentConfig.mode !== "none") {
    items.push({
      id: "attachments",
      label: "Attachment validity",
      severity: attachmentsMissing > 0 ? "critical" : "passed",
      detail: attachmentsMissing > 0 ? `${attachmentsMissing} attachment(s) missing on disk` : `${attachmentsValid} attachment(s) verified`,
      count: attachmentsMissing,
    });
  }

  // Recently contacted
  const recentEmails = getRecentlyContactedEmails(recipients.map((r) => r.email), opts.recentHours);
  items.push({
    id: "recent_contact",
    label: "Communication frequency",
    severity: recentEmails.size > 0 ? "warning" : "passed",
    detail:
      recentEmails.size > 0
        ? `${recentEmails.size} recipient(s) received an email within the last ${opts.recentHours}h`
        : "No recently contacted recipients",
    count: recentEmails.size,
  });

  // SMTP
  let smtpVerified = false;
  if (!smtp) {
    items.push({ id: "smtp", label: "SMTP configuration", severity: "critical", detail: "No SMTP profile selected" });
  } else if (opts.checkSmtp) {
    const password = getPassword(smtp.id);
    if (!password) {
      items.push({ id: "smtp", label: "SMTP configuration", severity: "critical", detail: "SMTP password not set for this session" });
    } else {
      const result = await verifyConnection(smtp, password);
      if (result.ok) {
        smtpVerified = true;
        items.push({ id: "smtp", label: "SMTP connection & authentication", severity: "passed", detail: `Verified connection to ${smtp.host}:${smtp.port}` });
      } else {
        items.push({ id: "smtp", label: "SMTP connection & authentication", severity: "critical", detail: result.message });
      }
    }
  }

  // Test email
  items.push({
    id: "test_email",
    label: "Test email sent",
    severity: campaign.testEmailSentAt ? "passed" : "warning",
    detail: campaign.testEmailSentAt ? `Test email accepted by SMTP at ${campaign.testEmailSentAt}` : "No test email has been sent yet",
  });

  const hasCriticalErrors = items.some((i) => i.severity === "critical");

  return {
    items,
    hasCriticalErrors,
    summary: {
      imported,
      unique,
      valid,
      invalid,
      duplicates,
      attachmentsValid,
      attachmentsMissing,
      missingValues,
      recentlyContacted: recentEmails.size,
      smtpVerified,
      testEmailSent: !!campaign.testEmailSentAt,
    },
  };
}
