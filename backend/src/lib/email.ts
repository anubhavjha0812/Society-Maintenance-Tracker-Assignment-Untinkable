import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

export interface SendEmailResult {
  ok: boolean;
  providerMessageId: string | null;
  error?: string;
}

/**
 * Every outbound email in the app goes through this one function. If the
 * email provider ever needs to change, only this file changes — nothing
 * in the notification worker or business logic touches Resend directly.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<SendEmailResult> {
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html: body,
  });

  if (error) {
    return { ok: false, providerMessageId: null, error: error.message };
  }
  return { ok: true, providerMessageId: data?.id ?? null };
}
