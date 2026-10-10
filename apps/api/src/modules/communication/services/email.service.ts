import { Resend } from 'resend';
import logger from '../../../config/logger';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL || 'Learning Haven <noreply@learninghaven.com>';

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    logger.warn('RESEND_API_KEY missing, email skipped', { to: payload.to, subject: payload.subject });
    return;
  }

  await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}

/** How email is set up (for the admin), without the key. */
export function emailStatus() {
  const key = process.env.RESEND_API_KEY ?? '';
  return {
    provider: 'Resend',
    configured: Boolean(resend),
    keyHint: key.length > 8 ? `••••${key.slice(-4)}` : key ? '••••' : '',
    from,
    fromIsDefault: !process.env.RESEND_FROM_EMAIL,
  };
}

/** Sends a short test message, reporting the provider's answer instead of throwing. */
export async function sendTestEmail(to: string): Promise<{ sent: boolean; message: string }> {
  if (!resend) return { sent: false, message: 'Email is not set up: RESEND_API_KEY is missing on the server.' };
  try {
    const { error } = (await resend.emails.send({
      from,
      to,
      subject: 'Forge test email',
      html: '<p>This is a test email from the Forge admin. If you can read it, email delivery works.</p>',
    })) as { error?: { message?: string } | null };
    if (error) return { sent: false, message: error.message ?? 'The email provider refused the message.' };
    return { sent: true, message: `Sent to ${to}` };
  } catch (error: any) {
    return { sent: false, message: error?.message ?? 'Sending failed' };
  }
}

export async function sendApprenticeshipWelcomeEmail(params: {
  to: string;
  name: string;
  programTitle: string;
  discordInviteLink?: string | null;
}) {
  await sendEmail({
    to: params.to,
    subject: `Welcome to ${params.programTitle}!`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome, ${params.name}!</h2>
        <p>You're now enrolled in <strong>${params.programTitle}</strong>.</p>
        <p>Start by connecting your GitHub account and cloning your first project.</p>
        ${params.discordInviteLink ? `<p><a href="${params.discordInviteLink}">Join the community Discord</a></p>` : ''}
        <p>Good luck building.</p>
      </div>
    `,
  });
}

export async function sendProjectPassedEmail(params: {
  to: string;
  name: string;
  projectTitle: string;
  xpEarned: number;
  nextProjectTitle?: string | null;
}) {
  await sendEmail({
    to: params.to,
    subject: `Project passed: ${params.projectTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${params.name}, your project passed.</h2>
        <p><strong>${params.projectTitle}</strong> is verified. You earned <strong>${params.xpEarned} XP</strong>.</p>
        ${params.nextProjectTitle ? `<p>Next up: <strong>${params.nextProjectTitle}</strong>.</p>` : ''}
      </div>
    `,
  });
}

export async function sendCertificateEmail(params: {
  to: string;
  name: string;
  programTitle: string;
  grade: string;
  verificationCode: string;
  certificateUrl: string;
  pdfUrl?: string | null;
}) {
  await sendEmail({
    to: params.to,
    subject: `Your ${params.programTitle} certificate is ready`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Congratulations, ${params.name}!</h2>
        <p>You completed <strong>${params.programTitle}</strong> with a grade of <strong>${params.grade}</strong>.</p>
        <p>Verification code: <strong>${params.verificationCode}</strong></p>
        <p><a href="${params.certificateUrl}">View certificate</a></p>
        ${params.pdfUrl ? `<p><a href="${params.pdfUrl}">Download PDF</a></p>` : ''}
      </div>
    `,
  });
}
