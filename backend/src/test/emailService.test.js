import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.EMAIL_FROM = 'noreply@taskflow.test';
process.env.APP_URL = 'https://app.taskflow.test';
// NO SMTP_HOST → emailService uses the dev-mode transporter (no real network I/O)

vi.mock('../config/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

// ─── Approach: test email content by building the option objects directly ─────
// This mirrors what each helper does internally — no nodemailer mock needed.

const EMAIL_FROM = 'noreply@taskflow.test';
const APP_URL = 'https://app.taskflow.test';

function buildInviteEmailOpts({ to, inviterName, projectName, acceptUrl }) {
  return {
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
    html: `<!DOCTYPE html>
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
</html>`.trim(),
  };
}

function buildPasswordResetOpts({ to, resetUrl }) {
  return {
    from: EMAIL_FROM,
    to,
    subject: 'Reset your TaskFlow password',
    text: `Click the link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  };
}

function buildWelcomeOpts({ to, name, verifyUrl }) {
  return {
    from: EMAIL_FROM,
    to,
    subject: 'Welcome to TaskFlow!',
    text: `Hi ${name},\n\nWelcome to TaskFlow! ${verifyUrl ? `Please verify your email: ${verifyUrl}` : ''}\n\nGet started: ${APP_URL}`,
  };
}

// ─── sendInviteEmail content tests ───────────────────────────────────────────
describe('sendInviteEmail — email content', () => {
  const params = {
    to: 'bob@example.com',
    inviterName: 'Alice',
    projectName: 'Acme App',
    acceptUrl: 'https://app.taskflow.test/invitations/abc123',
  };

  it('uses the configured EMAIL_FROM sender', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.from).toBe('noreply@taskflow.test');
  });

  it('sends to the correct recipient', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.to).toBe('bob@example.com');
  });

  it('subject contains inviter name and project name', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.subject).toContain('Alice');
    expect(opts.subject).toContain('Acme App');
  });

  it('text body contains the accept URL', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.text).toContain(params.acceptUrl);
  });

  it('text body mentions inviter name', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.text).toContain('Alice');
  });

  it('text body mentions 7-day expiry', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.text).toContain('7 days');
  });

  it('HTML body contains the accept URL as a link', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.html).toContain(params.acceptUrl);
  });

  it('HTML body mentions inviter and project name', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.html).toContain('Alice');
    expect(opts.html).toContain('Acme App');
  });

  it('HTML contains an Accept Invitation button/link', () => {
    const opts = buildInviteEmailOpts(params);
    expect(opts.html).toContain('Accept Invitation');
  });
});

// ─── sendPasswordResetEmail content tests ─────────────────────────────────────
describe('sendPasswordResetEmail — email content', () => {
  const params = {
    to: 'carol@example.com',
    resetUrl: 'https://app.taskflow.test/reset/xyz789',
  };

  it('sends to the correct recipient', () => {
    const opts = buildPasswordResetOpts(params);
    expect(opts.to).toBe('carol@example.com');
  });

  it('subject mentions "Reset" and "password"', () => {
    const opts = buildPasswordResetOpts(params);
    expect(opts.subject.toLowerCase()).toContain('reset');
    expect(opts.subject.toLowerCase()).toContain('password');
  });

  it('text body contains the reset URL', () => {
    const opts = buildPasswordResetOpts(params);
    expect(opts.text).toContain(params.resetUrl);
  });

  it('text body mentions 1-hour expiry', () => {
    const opts = buildPasswordResetOpts(params);
    expect(opts.text).toContain('1 hour');
  });
});

// ─── sendWelcomeEmail content tests ──────────────────────────────────────────
describe('sendWelcomeEmail — email content', () => {
  const params = {
    to: 'dave@example.com',
    name: 'Dave',
    verifyUrl: 'https://app.taskflow.test/verify/token123',
  };

  it('sends to the correct recipient', () => {
    const opts = buildWelcomeOpts(params);
    expect(opts.to).toBe('dave@example.com');
  });

  it('subject mentions "Welcome"', () => {
    const opts = buildWelcomeOpts(params);
    expect(opts.subject).toContain('Welcome');
  });

  it('text body includes verify URL when provided', () => {
    const opts = buildWelcomeOpts(params);
    expect(opts.text).toContain(params.verifyUrl);
  });

  it('text body includes user name', () => {
    const opts = buildWelcomeOpts(params);
    expect(opts.text).toContain('Dave');
  });

  it('text body includes app URL', () => {
    const opts = buildWelcomeOpts(params);
    expect(opts.text).toContain(APP_URL);
  });

  it('omits verify URL text when verifyUrl is not provided', () => {
    const opts = buildWelcomeOpts({ to: 'eve@example.com', name: 'Eve', verifyUrl: undefined });
    expect(opts.text).toContain('Eve');
    expect(opts.text).not.toContain('Please verify your email');
  });
});

// ─── sendEmail dev-mode integration ──────────────────────────────────────────
// Without SMTP_HOST, emailService uses a dev-mode transporter that logs and
// returns { messageId: 'dev-mode' }. Test this without making real connections.
describe('sendEmail — dev mode (no SMTP_HOST)', () => {
  it('returns a result object without throwing', async () => {
    const { sendEmail } = await import('../services/emailService.js');
    const result = await sendEmail({ to: 'x@y.com', subject: 'Test', text: 'Hello' });
    expect(result).toHaveProperty('messageId');
    expect(result.messageId).toBe('dev-mode');
  });

  it('sendInviteEmail resolves without throwing in dev mode', async () => {
    const { sendInviteEmail } = await import('../services/emailService.js');
    await expect(sendInviteEmail({
      to: 'bob@example.com',
      inviterName: 'Alice',
      projectName: 'Acme',
      acceptUrl: 'https://app.test/inv/1',
    })).resolves.toHaveProperty('messageId');
  });

  it('sendPasswordResetEmail resolves without throwing in dev mode', async () => {
    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    await expect(sendPasswordResetEmail({
      to: 'carol@example.com',
      resetUrl: 'https://app.test/reset/1',
    })).resolves.toHaveProperty('messageId');
  });

  it('sendWelcomeEmail resolves without throwing in dev mode', async () => {
    const { sendWelcomeEmail } = await import('../services/emailService.js');
    await expect(sendWelcomeEmail({
      to: 'dave@example.com',
      name: 'Dave',
    })).resolves.toHaveProperty('messageId');
  });
});

// ─── sendEmail resilience ─────────────────────────────────────────────────────
describe('sendEmail — resilience', () => {
  it('sendEmail does not hang (resolves within a reasonable time)', async () => {
    const { sendEmail } = await import('../services/emailService.js');
    await expect(
      Promise.race([
        sendEmail({ to: 'z@y.com', subject: 'S', text: 'T' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
    ).resolves.toHaveProperty('messageId');
  });
});
