import nodemailer, { Transporter } from "nodemailer";
import type { SmtpProfile, FailureCategory } from "../../shared/types";

export function buildTransport(profile: SmtpProfile, password: string): Transporter {
  return nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.security === "ssl", // true for 465 (implicit TLS)
    requireTLS: profile.security === "tls", // STARTTLS for 587
    auth: {
      user: profile.username,
      pass: password,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

export async function verifyConnection(profile: SmtpProfile, password: string): Promise<{ ok: true } | { ok: false; category: FailureCategory; message: string }> {
  const transport = buildTransport(profile, password);
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, ...classifyError(err) };
  } finally {
    transport.close();
  }
}

export interface SendMailInput {
  from: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  attachments?: { filename: string; path: string }[];
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  category?: FailureCategory;
  message?: string;
}

export async function sendMail(
  transport: Transporter,
  input: SendMailInput
): Promise<SendMailResult> {
  try {
    const info = await transport.sendMail({
      from: input.from,
      to: input.to,
      cc: input.cc && input.cc.length > 0 ? input.cc : undefined,
      bcc: input.bcc && input.bcc.length > 0 ? input.bcc : undefined,
      replyTo: input.replyTo ?? undefined,
      subject: input.subject,
      html: input.html ?? undefined,
      text: input.text ?? undefined,
      attachments: input.attachments,
    });
    if (info.rejected && info.rejected.length > 0) {
      return {
        ok: false,
        category: "smtp_rejection",
        message: `SMTP rejected recipient: ${info.rejected.join(", ")}`,
        rejected: info.rejected as string[],
      };
    }
    return { ok: true, messageId: info.messageId, accepted: info.accepted as string[] };
  } catch (err) {
    return { ok: false, ...classifyError(err) };
  }
}

function classifyError(err: unknown): { category: FailureCategory; message: string } {
  const e = err as { code?: string; responseCode?: number; message?: string; command?: string };
  const message = e?.message ?? String(err);
  const code = e?.code;
  const responseCode = e?.responseCode;

  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return { category: "auth_failure", message: sanitize(message) };
  }
  if (code === "ECONNECTION" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return { category: "connection_failure", message: sanitize(message) };
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET") {
    return { category: "timeout", message: sanitize(message) };
  }
  if (responseCode && responseCode >= 550 && responseCode < 560) {
    return { category: "invalid_recipient", message: sanitize(message) };
  }
  if (responseCode && responseCode >= 500) {
    return { category: "smtp_rejection", message: sanitize(message) };
  }
  if (code === "ENETUNREACH" || code === "EAI_AGAIN") {
    return { category: "network_error", message: sanitize(message) };
  }
  return { category: "other", message: sanitize(message) };
}

// Strip anything that looks like it might echo back credentials from SMTP
// error text before it's ever logged or shown to the user.
function sanitize(message: string): string {
  return message.replace(/(pass(word)?|auth|credential)[^,;\n]*/gi, "[redacted]").slice(0, 500);
}
