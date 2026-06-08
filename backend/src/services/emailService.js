const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, APP_URL } = require('../config/env');
const logger = require('../config/logger');

let transporter;

function getTransporter() {
  if (!transporter) {
    if (SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      });
    } else {
      // Dev fallback — log email instead of sending
      transporter = {
        sendMail: async (opts) => {
          logger.info({ to: opts.to, subject: opts.subject }, 'email.dev_mode');
          if (opts.text) logger.debug({ body: opts.text.slice(0, 200) }, 'email.dev_body');
          return { messageId: 'dev-mode' };
        },
      };
    }
  }
  return transporter;
}

async function sendEmail(opts) {
  try {
    const result = await getTransporter().sendMail(opts);
    logger.info({ to: opts.to, subject: opts.subject, messageId: result.messageId }, 'email.sent');
    return result;
  } catch (err) {
    logger.error({ to: opts.to, subject: opts.subject, err: err.message }, 'email.send_failed');
    throw err;
  }
}

async function sendInviteEmail({ to, inviterName, projectName, acceptUrl }) {
  return sendEmail({
    from: EMAIL_FROM,
    to,
    subject: `${inviterName} invited you to join ${projectName} on TaskFlow`,
    text: `
Hi,

${inviterName} has invited you to join the project "${projectName}" on TaskFlow.

Click the link below to accept your invitation:
${acceptUrl}

This invitation expires in 7 days.

— The TaskFlow Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1e293b">
  <div style="background:#6366f1;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">TaskFlow</h1>
  </div>
  <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="margin-top:0">You're invited!</h2>
    <p><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> on TaskFlow.</p>
    <a href="${acceptUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
      Accept Invitation
    </a>
    <p style="color:#64748b;font-size:13px;margin-top:24px">
      This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.
    </p>
  </div>
</body>
</html>
    `.trim(),
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  return sendEmail({
    from: EMAIL_FROM,
    to,
    subject: 'Reset your TaskFlow password',
    text: `Click the link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1e293b">
  <div style="background:#6366f1;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">TaskFlow</h1>
  </div>
  <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="margin-top:0">Reset your password</h2>
    <p>Click the button below to reset your password. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      Reset Password
    </a>
    <p style="color:#64748b;font-size:13px;margin-top:24px">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
    `.trim(),
  });
}

async function sendWelcomeEmail({ to, name, verifyUrl }) {
  return sendEmail({
    from: EMAIL_FROM,
    to,
    subject: 'Welcome to TaskFlow!',
    text: `Hi ${name},\n\nWelcome to TaskFlow! ${verifyUrl ? `Please verify your email: ${verifyUrl}` : ''}\n\nGet started: ${APP_URL}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1e293b">
  <div style="background:#6366f1;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">Welcome to TaskFlow!</h1>
  </div>
  <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="margin-top:0">Hi ${name}!</h2>
    <p>Your account is ready. Start managing projects and tasks with your team.</p>
    ${verifyUrl ? `<p><strong>Please verify your email to unlock all features:</strong></p>
    <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">Verify Email</a>` : ''}
    <a href="${APP_URL}/app/dashboard" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Go to Dashboard</a>
    <p style="color:#64748b;font-size:13px;margin-top:24px">Need help? Reply to this email.</p>
  </div>
</body>
</html>`.trim(),
  });
}

module.exports = { sendInviteEmail, sendPasswordResetEmail, sendWelcomeEmail, sendEmail };
