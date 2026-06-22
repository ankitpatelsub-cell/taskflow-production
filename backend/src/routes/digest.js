'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendDigestForSubscription } = require('../services/digestService');

const router = express.Router();
router.use(authenticate);

// GET /api/me/digest-subscriptions
router.get('/', async (req, res) => {
  try {
    const subs = await queryAll(
      `SELECT ds.*, p.name AS project_name
       FROM digest_subscriptions ds
       LEFT JOIN projects p ON p.id = ds.project_id
       WHERE ds.user_id = ?
       ORDER BY ds.created_at ASC`,
      [req.user.id]
    );
    res.json(subs);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch subscriptions' }); }
});

// POST /api/me/digest-subscriptions
router.post('/', async (req, res) => {
  try {
    const {
      project_id = null, frequency = 'weekly', day_of_week = 1, hour_utc = 8,
      include_overdue = true, include_due_soon = true, include_activity = true, include_sprints = true,
    } = req.body;

    if (!['daily', 'weekly'].includes(frequency)) return res.status(400).json({ error: 'Invalid frequency' });

    const existing = await queryOne(
      'SELECT id FROM digest_subscriptions WHERE user_id = ? AND project_id IS NOT DISTINCT FROM ? AND frequency = ?',
      [req.user.id, project_id, frequency]
    );
    if (existing) return res.status(409).json({ error: 'Subscription already exists' });

    const id = uuidv4();
    await execute(
      `INSERT INTO digest_subscriptions
         (id, user_id, project_id, frequency, day_of_week, hour_utc,
          include_overdue, include_due_soon, include_activity, include_sprints)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, project_id, frequency, Number(day_of_week), Number(hour_utc),
       !!include_overdue, !!include_due_soon, !!include_activity, !!include_sprints]
    );
    const sub = await queryOne('SELECT * FROM digest_subscriptions WHERE id = ?', [id]);
    res.status(201).json(sub);
  } catch (err) { res.status(500).json({ error: 'Failed to create subscription' }); }
});

// PATCH /api/me/digest-subscriptions/:id
router.patch('/:id', async (req, res) => {
  try {
    const sub = await queryOne('SELECT id FROM digest_subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const { frequency, day_of_week, hour_utc, include_overdue, include_due_soon, include_activity, include_sprints } = req.body;
    await execute(
      `UPDATE digest_subscriptions SET
         frequency = COALESCE(?, frequency), day_of_week = COALESCE(?, day_of_week),
         hour_utc = COALESCE(?, hour_utc),
         include_overdue = COALESCE(?, include_overdue), include_due_soon = COALESCE(?, include_due_soon),
         include_activity = COALESCE(?, include_activity), include_sprints = COALESCE(?, include_sprints)
       WHERE id = ?`,
      [frequency || null, day_of_week != null ? Number(day_of_week) : null,
       hour_utc != null ? Number(hour_utc) : null,
       include_overdue != null ? !!include_overdue : null, include_due_soon != null ? !!include_due_soon : null,
       include_activity != null ? !!include_activity : null, include_sprints != null ? !!include_sprints : null,
       req.params.id]
    );
    const updated = await queryOne('SELECT * FROM digest_subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Failed to update subscription' }); }
});

// DELETE /api/me/digest-subscriptions/:id
router.delete('/:id', async (req, res) => {
  try {
    const sub = await queryOne('SELECT id FROM digest_subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    await execute('DELETE FROM digest_subscriptions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete subscription' }); }
});

// POST /api/me/digest-subscriptions/:id/send-now (preview/test)
router.post('/:id/send-now', async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM digest_subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    await sendDigestForSubscription(sub);
    res.json({ message: 'Digest sent to your email' });
  } catch (err) { res.status(500).json({ error: 'Failed to send digest' }); }
});

module.exports = router;
