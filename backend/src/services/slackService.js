const https = require('https');
const { queryOne } = require('../config/db');
const logger = require('../config/logger');

async function sendSlackMessage(webhookUrl, text) {
  const url = new URL(webhookUrl);
  const body = JSON.stringify({ text });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => (res.statusCode < 300 ? resolve(d) : reject(new Error(`Slack ${res.statusCode}`))));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const STATUS_EMOJI = { todo: '📋', in_progress: '🔄', review: '👀', done: '✅' };
const PRIORITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

async function notifySlack(projectId, event, task) {
  try {
    const project = await queryOne('SELECT slack_webhook_url, name FROM projects WHERE id = ?', [projectId]);
    if (!project?.slack_webhook_url) return;

    let text;
    if (event === 'created') {
      text = `${PRIORITY_EMOJI[task.priority] || '📋'} *New task* in *${project.name}*: ${task.title}`;
    } else if (event === 'completed') {
      text = `✅ *Task completed* in *${project.name}*: ${task.title}`;
    } else if (event === 'updated') {
      const status = task.status ? `${STATUS_EMOJI[task.status] || ''} → ${task.status}` : '';
      text = `🔄 *Task updated* in *${project.name}*: ${task.title}${status ? ` (${status})` : ''}`;
    } else if (event === 'automation') {
      text = task._msg || `[Automation] Task "${task.title}"`;
    } else {
      return;
    }

    await sendSlackMessage(project.slack_webhook_url, text);
  } catch (err) {
    // Non-fatal — log and continue
    logger.warn({ projectId, event, err: err.message }, 'slack.notify.failed');
  }
}

module.exports = { notifySlack };
