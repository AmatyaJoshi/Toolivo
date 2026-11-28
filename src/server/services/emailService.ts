import type { BillingDatabase } from '../db/billingDb.ts';

export interface SendEmailInput {
  to: string;
  template:
    | 'pro_license_delivered'
    | 'license_recovery'
    | 'sponsor_payment_received'
    | 'sponsor_approved'
    | 'sponsor_rejected'
    | 'sponsor_refunded'
    | 'admin_sponsor_alert';
  subject: string;
  bodyText: string;
}

/**
 * Dispatches transactional billing notifications via Resend when RESEND_API_KEY is configured,
 * and always records an auditable entry in the billing database's email_notifications table.
 */
export async function sendTransactionalEmail(
  db: BillingDatabase,
  input: SendEmailInput
): Promise<{ delivered: boolean; mode: 'resend' | 'sandbox_log'; id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'Toolivo Billing <billing@toolivo.app>';

  if (apiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.bodyText,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as { id?: string };
        const rec = db.logEmailNotification({
          recipientEmail: input.to,
          template: input.template,
          subject: input.subject,
          bodyText: input.bodyText,
          deliveryStatus: 'sent',
          providerMessageId: json.id || null,
        });
        return { delivered: true, mode: 'resend', id: rec.id };
      }
    } catch (err) {
      console.error('Transactional email dispatch failed, falling back to audit log:', err);
    }
  }

  const rec = db.logEmailNotification({
    recipientEmail: input.to,
    template: input.template,
    subject: input.subject,
    bodyText: input.bodyText,
    deliveryStatus: 'logged_sandbox',
    providerMessageId: null,
  });
  return { delivered: true, mode: 'sandbox_log', id: rec.id };
}
