const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHttpsUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * POST a JSON payload to a URL using Node's built-in https module.
 * Resolves with the response status code or rejects on network error.
 * Hard timeout: 5 seconds.
 */
function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      // Drain the response body so the socket is released
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out after 5s'));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Build the X-Tick-Signature header value for a given payload and secret.
 * Format: sha256=<hex digest>
 */
function signPayload(secret, body) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
}

// ─── CRUD Routes ──────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/webhooks
router.get('/', async (req, res) => {
  try {
    const webhooks = await queryAll(
      `SELECT id, project_id, url, events, active, created_by, created_at
       FROM webhooks
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      [req.params.projectId]
    );
    res.json(webhooks);
  } catch (err) {
    req.log.error({ err, projectId: req.params.projectId }, 'webhooks.list.error');
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// POST /api/projects/:projectId/webhooks
router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { url, events, secret } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    if (!isValidHttpsUrl(url)) {
      return res.status(400).json({ error: 'url must be a valid https URL' });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events must be a non-empty array' });
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO webhooks (id, project_id, url, events, secret, active, created_by)
       VALUES (?, ?, ?, ?, ?, true, ?)`,
      [id, req.params.projectId, url, JSON.stringify(events), secret || null, req.user.id]
    );

    const webhook = await queryOne(
      `SELECT id, project_id, url, events, active, created_by, created_at
       FROM webhooks WHERE id = ?`,
      [id]
    );

    req.log.info({ webhookId: id, projectId: req.params.projectId }, 'webhooks.created');
    res.status(201).json(webhook);
  } catch (err) {
    req.log.error({ err, projectId: req.params.projectId }, 'webhooks.create.error');
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// PATCH /api/projects/:projectId/webhooks/:webhookId
router.patch('/:webhookId', requireWriteAccess, async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT id FROM webhooks WHERE id = ? AND project_id = ?',
      [req.params.webhookId, req.params.projectId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const { url, events, active } = req.body;
    const sets = [];
    const vals = [];

    if (url !== undefined) {
      if (!isValidHttpsUrl(url)) {
        return res.status(400).json({ error: 'url must be a valid https URL' });
      }
      sets.push('url = ?');
      vals.push(url);
    }
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events must be a non-empty array' });
      }
      sets.push('events = ?');
      vals.push(JSON.stringify(events));
    }
    if (active !== undefined) {
      sets.push('active = ?');
      vals.push(Boolean(active));
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    vals.push(req.params.webhookId, req.params.projectId);
    await execute(
      `UPDATE webhooks SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
      vals
    );

    const webhook = await queryOne(
      `SELECT id, project_id, url, events, active, created_by, created_at
       FROM webhooks WHERE id = ?`,
      [req.params.webhookId]
    );

    req.log.info({ webhookId: req.params.webhookId, projectId: req.params.projectId }, 'webhooks.updated');
    res.json(webhook);
  } catch (err) {
    req.log.error({ err, webhookId: req.params.webhookId, projectId: req.params.projectId }, 'webhooks.update.error');
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// DELETE /api/projects/:projectId/webhooks/:webhookId
router.delete('/:webhookId', requireWriteAccess, async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT id FROM webhooks WHERE id = ? AND project_id = ?',
      [req.params.webhookId, req.params.projectId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await execute(
      'DELETE FROM webhooks WHERE id = ? AND project_id = ?',
      [req.params.webhookId, req.params.projectId]
    );

    req.log.info({ webhookId: req.params.webhookId, projectId: req.params.projectId }, 'webhooks.deleted');
    res.json({ message: 'Deleted' });
  } catch (err) {
    req.log.error({ err, webhookId: req.params.webhookId, projectId: req.params.projectId }, 'webhooks.delete.error');
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// POST /api/projects/:projectId/webhooks/:webhookId/test
router.post('/:webhookId/test', requireWriteAccess, async (req, res) => {
  try {
    const webhook = await queryOne(
      'SELECT id, url, secret FROM webhooks WHERE id = ? AND project_id = ?',
      [req.params.webhookId, req.params.projectId]
    );
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const payload = { event: 'ping', timestamp: new Date().toISOString() };

    const extraHeaders = {};
    if (webhook.secret) {
      extraHeaders['X-Tick-Signature'] = signPayload(webhook.secret, payload);
    }

    try {
      const statusCode = await httpsPost(webhook.url, payload, extraHeaders);
      const success = statusCode >= 200 && statusCode < 300;
      req.log.info({ webhookId: webhook.id, statusCode }, 'webhooks.test.sent');
      res.json({ success, statusCode });
    } catch (deliveryErr) {
      req.log.warn({ webhookId: webhook.id, err: deliveryErr.message }, 'webhooks.test.delivery_failed');
      res.json({ success: false, error: deliveryErr.message });
    }
  } catch (err) {
    req.log.error({ err, webhookId: req.params.webhookId, projectId: req.params.projectId }, 'webhooks.test.error');
    res.status(500).json({ error: 'Failed to send test webhook' });
  }
});

// ─── dispatchWebhook ──────────────────────────────────────────────────────────

/**
 * Fire-and-forget: delivers an event to all active webhooks for a project
 * that are subscribed to the given event type.
 *
 * @param {string} projectId
 * @param {string} event      - e.g. 'task:created'
 * @param {object} payload    - arbitrary event data
 */
async function dispatchWebhook(projectId, event, payload) {
  try {
    const webhooks = await queryAll(
      `SELECT id, url, secret
       FROM webhooks
       WHERE project_id = ?
         AND active = true
         AND events @> ?::jsonb`,
      [projectId, JSON.stringify([event])]
    );

    if (!webhooks.length) return;

    const body = { event, payload, timestamp: new Date().toISOString() };

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          const extraHeaders = {};
          if (webhook.secret) {
            extraHeaders['X-Tick-Signature'] = signPayload(webhook.secret, body);
          }
          await httpsPost(webhook.url, body, extraHeaders);
        } catch {
          // Silently swallow delivery errors — fire-and-forget
        }
      })
    );
  } catch {
    // Silently swallow query errors — callers must not be interrupted
  }
}

module.exports = router;
module.exports.dispatchWebhook = dispatchWebhook;
