'use strict';

const { queryAll } = require('../config/db');
const { sendEmail } = require('./emailService');
const { EMAIL_FROM, APP_URL } = require('../config/env');
const logger = require('../config/logger');

function priorityColor(priority) {
  return { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[priority] || '#6b7280';
}

function buildDigestHtml({ user, projects, overdue, dueSoon, recentActivity, activeSprints }) {
  const appUrl = APP_URL || 'https://app.tickapp.io';
  const totalTasks = overdue.length + dueSoon.length;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Tick Digest</title></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:580px;margin:0 auto">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;border-radius:16px 16px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Tick</h1>
    <p style="color:#e0e7ff;margin:6px 0 0;font-size:14px">Your project digest · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  </div>

  <!-- Body -->
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px">
    <p style="margin-top:0;color:#374151">Hi <strong>${user.name}</strong>, here's your task summary:</p>

    ${totalTasks === 0 && recentActivity.length === 0
      ? '<p style="color:#6b7280;text-align:center;padding:20px 0;font-size:15px">✅ All caught up! No urgent items.</p>'
      : ''
    }

    ${overdue.length > 0 ? `
    <!-- Overdue -->
    <div style="margin-bottom:24px">
      <h2 style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 12px;display:flex;align-items:center;gap:6px">
        ⚠️ Overdue (${overdue.length})
      </h2>
      ${overdue.map((t) => `
      <div style="border-left:3px solid ${priorityColor(t.priority)};padding:10px 14px;margin-bottom:8px;background:#fff9f9;border-radius:0 8px 8px 0">
        <a href="${appUrl}/app/projects/${t.project_id}/board" style="color:#111;text-decoration:none;font-weight:600;font-size:14px">${t.title}</a>
        <div style="color:#9ca3af;font-size:12px;margin-top:3px">${t.project_name} · Due ${new Date(t.due_date).toLocaleDateString()}</div>
      </div>`).join('')}
    </div>` : ''}

    ${dueSoon.length > 0 ? `
    <!-- Due soon -->
    <div style="margin-bottom:24px">
      <h2 style="font-size:15px;font-weight:700;color:#d97706;margin:0 0 12px">
        📅 Due soon (${dueSoon.length})
      </h2>
      ${dueSoon.map((t) => `
      <div style="border-left:3px solid #fbbf24;padding:10px 14px;margin-bottom:8px;background:#fffbf0;border-radius:0 8px 8px 0">
        <a href="${appUrl}/app/projects/${t.project_id}/board" style="color:#111;text-decoration:none;font-weight:600;font-size:14px">${t.title}</a>
        <div style="color:#9ca3af;font-size:12px;margin-top:3px">${t.project_name} · Due ${new Date(t.due_date).toLocaleDateString()}</div>
      </div>`).join('')}
    </div>` : ''}

    ${activeSprints.length > 0 ? `
    <!-- Sprint progress -->
    <div style="margin-bottom:24px">
      <h2 style="font-size:15px;font-weight:700;color:#374151;margin:0 0 12px">🏃 Active sprints</h2>
      ${activeSprints.map((s) => {
        const pct = s.total_tasks > 0 ? Math.round(s.done_tasks / s.total_tasks * 100) : 0;
        return `
      <div style="padding:12px 16px;background:#f8fafc;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:14px">${s.name}</strong>
          <span style="font-size:12px;color:#6b7280">${s.project_name}</span>
        </div>
        <div style="margin-top:8px;background:#e2e8f0;height:6px;border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;background:#6366f1;height:6px;border-radius:3px"></div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">${s.done_tasks}/${s.total_tasks} tasks · ${pct}% complete</div>
      </div>`;
      }).join('')}
    </div>` : ''}

    ${recentActivity.length > 0 ? `
    <!-- Recent activity -->
    <div style="margin-bottom:24px">
      <h2 style="font-size:15px;font-weight:700;color:#374151;margin:0 0 12px">💬 Recent activity</h2>
      ${recentActivity.slice(0, 8).map((a) => `
      <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151">
        <strong>${a.actor_name}</strong> ${a.action} <em>${a.task_title}</em>
        <span style="color:#9ca3af;font-size:11px;display:block;margin-top:2px">${a.project_name} · ${new Date(a.created_at).toLocaleString()}</span>
      </div>`).join('')}
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin-top:28px">
      <a href="${appUrl}/app/dashboard" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Open Tick
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0 16px"/>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
      You're receiving this because you subscribed to digest emails.
      <a href="${appUrl}/app/profile" style="color:#6366f1">Manage preferences</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

async function sendDigestForSubscription(sub) {
  const lookbackHours = sub.frequency === 'daily' ? 24 : 168;
  const projectFilter = sub.project_id ? 'AND t.project_id = ?' : '';
  const projectParam = sub.project_id ? [sub.project_id] : [];

  const [user] = await queryAll('SELECT id, name, email FROM users WHERE id = ?', [sub.user_id]);
  if (!user) return;

  const baseWhere = `
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
    WHERE (t.assignee_id = ? OR pm.user_id = ?) AND t.status != 'done'
    ${projectFilter}
  `;
  const baseParams = [sub.user_id, sub.user_id, sub.user_id, ...projectParam];

  const [overdue, dueSoon, recentActivity, activeSprints] = await Promise.all([
    sub.include_overdue ? queryAll(
      `SELECT t.id, t.title, t.priority, t.due_date, t.project_id, p.name AS project_name
       ${baseWhere} AND t.due_date < NOW()
       ORDER BY t.due_date ASC LIMIT 10`,
      baseParams
    ) : [],
    sub.include_due_soon ? queryAll(
      `SELECT t.id, t.title, t.priority, t.due_date, t.project_id, p.name AS project_name
       ${baseWhere} AND t.due_date >= NOW() AND t.due_date <= NOW() + INTERVAL '7 days'
       ORDER BY t.due_date ASC LIMIT 10`,
      baseParams
    ) : [],
    sub.include_activity ? queryAll(
      `SELECT c.created_at, u.name AS actor_name, t.title AS task_title, p.name AS project_name,
              'commented on' AS action
       FROM comments c
       JOIN tasks t ON t.id = c.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
       WHERE (t.assignee_id = ? OR t.created_by = ? OR pm.user_id = ?)
         AND c.created_at > NOW() - INTERVAL '${lookbackHours} hours'
         AND c.user_id != ?
         ${sub.project_id ? 'AND t.project_id = ?' : ''}
       ORDER BY c.created_at DESC LIMIT 15`,
      [sub.user_id, sub.user_id, sub.user_id, sub.user_id, sub.user_id, ...projectParam]
    ) : [],
    sub.include_sprints ? queryAll(
      `SELECT s.id, s.name, p.name AS project_name,
              COUNT(t.id) AS total_tasks,
              COUNT(t.id) FILTER (WHERE t.status = 'done') AS done_tasks
       FROM sprints s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN tasks t ON t.sprint_id = s.id
       LEFT JOIN project_members pm ON pm.project_id = s.project_id AND pm.user_id = ?
       WHERE s.status = 'active' AND (pm.user_id = ?)
         ${sub.project_id ? 'AND s.project_id = ?' : ''}
       GROUP BY s.id, p.name
       LIMIT 5`,
      [sub.user_id, sub.user_id, ...projectParam]
    ) : [],
  ]);

  if (overdue.length === 0 && dueSoon.length === 0 && recentActivity.length === 0 && activeSprints.length === 0) {
    logger.debug({ userId: sub.user_id }, '[digest] nothing to report — skipping');
    return;
  }

  const html = buildDigestHtml({ user, overdue, dueSoon, recentActivity, activeSprints });
  const freqLabel = sub.frequency === 'daily' ? 'Daily' : 'Weekly';
  const projectLabel = sub.project_id ? '' : ' (All Projects)';

  await sendEmail({
    from: EMAIL_FROM,
    to: user.email,
    subject: `${freqLabel} Digest${projectLabel}: ${overdue.length} overdue, ${dueSoon.length} due soon`,
    html,
    text: `Hi ${user.name},\n\nYou have ${overdue.length} overdue and ${dueSoon.length} upcoming tasks.\n\nOpen Tick: ${APP_URL || ''}/app/dashboard`,
  });
  logger.info({ userId: sub.user_id, frequency: sub.frequency }, '[digest] sent');
}

async function runDigestJob() {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay();

  const subs = await queryAll(
    `SELECT * FROM digest_subscriptions
     WHERE hour_utc = ?
       AND (
         (frequency = 'daily')
         OR (frequency = 'weekly' AND day_of_week = ?)
       )`,
    [currentHour, currentDay]
  );

  for (const sub of subs) {
    try {
      await sendDigestForSubscription(sub);
      await queryAll('UPDATE digest_subscriptions SET last_sent_at = NOW() WHERE id = ?', [sub.id]);
    } catch (err) {
      logger.error({ err: err.message, subId: sub.id }, '[digest] failed to send');
    }
  }
}

module.exports = { runDigestJob, sendDigestForSubscription };
