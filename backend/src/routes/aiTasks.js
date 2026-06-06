'use strict';

const express = require('express');
const { queryAll } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { ANTHROPIC_API_KEY } = require('../config/env');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// ── Shared helpers ────────────────────────────────────────────────────────────

function noApiKeyResponse(res) {
  return res.status(503).json({ error: 'AI not configured' });
}

/**
 * Extract the first JSON object from a Claude response string.
 * Claude sometimes wraps JSON in prose or code fences, so we use a regex.
 */
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in AI response');
  return JSON.parse(match[0]);
}

function getClient() {
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic.default({ apiKey: ANTHROPIC_API_KEY });
}

// ── POST /api/projects/:projectId/ai/breakdown ────────────────────────────────
// Break a task down into subtask suggestions.
// Body: { title, description, count? }
router.post('/breakdown', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return noApiKeyResponse(res);

  const { title, description, count = 5 } = req.body;
  const { projectId } = req.params;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const subtaskCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);

  try {
    const client = getClient();

    const prompt = `You are a project management assistant helping to break down tasks into actionable subtasks.

Task to break down:
Title: ${title}
${description ? `Description: ${description}` : ''}

Generate exactly ${subtaskCount} subtask suggestions that together cover the full scope of this task.
Each subtask should be concrete, actionable, and independently completable.
Assign a priority (low, medium, high, or critical) based on importance and likely dependencies.

Respond with a JSON object in this exact format (no prose, no markdown):
{
  "subtasks": [
    { "title": "...", "priority": "medium" }
  ]
}`;

    req.log.info({ projectId, userId: req.user.id, taskTitle: title, count: subtaskCount }, 'ai.breakdown_requested');

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text;

    let parsed;
    try {
      parsed = extractJson(text);
    } catch {
      req.log.warn({ projectId, userId: req.user.id, rawResponse: text }, 'ai.breakdown_parse_failed');
      return res.status(502).json({ error: 'AI returned an unexpected response format' });
    }

    const subtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];

    req.log.info({ projectId, userId: req.user.id, subtaskCount: subtasks.length }, 'ai.breakdown_complete');

    return res.json({ subtasks });
  } catch (err) {
    req.log.error({ projectId, userId: req.user.id, err: err.message }, 'ai.breakdown_failed');
    return res.status(500).json({ error: 'Failed to generate subtask breakdown' });
  }
});

// ── POST /api/projects/:projectId/ai/meeting-notes ───────────────────────────
// Parse raw meeting notes into actionable task suggestions, optionally assigning
// to known project members by name.
// Body: { notes, projectId? }
router.post('/meeting-notes', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return noApiKeyResponse(res);

  const { notes } = req.body;
  const { projectId } = req.params;

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'notes is required' });
  }

  try {
    // Fetch member names so Claude can attempt assignment
    const members = await queryAll(
      `SELECT u.name
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`,
      [projectId]
    );
    const memberNames = members.map((m) => m.name);

    const client = getClient();

    const prompt = `You are a project management assistant that extracts action items from meeting notes.

Project members: ${memberNames.length > 0 ? memberNames.join(', ') : '(none listed)'}

Meeting notes:
---
${notes.trim()}
---

Extract all action items, decisions that require follow-up, and tasks mentioned in these notes.
For each task:
- Write a clear, concise title
- Write a short description with any relevant context from the notes
- If a person is explicitly mentioned as responsible, set assignee_name to the closest matching name from the member list; otherwise leave it null
- Set priority based on urgency language in the notes (critical / high / medium / low)

Respond with a JSON object in this exact format (no prose, no markdown):
{
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "assignee_name": "Full Name or null",
      "priority": "medium"
    }
  ]
}`;

    req.log.info({ projectId, userId: req.user.id, notesLength: notes.length, memberCount: memberNames.length }, 'ai.meeting_notes_requested');

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text;

    let parsed;
    try {
      parsed = extractJson(text);
    } catch {
      req.log.warn({ projectId, userId: req.user.id, rawResponse: text }, 'ai.meeting_notes_parse_failed');
      return res.status(502).json({ error: 'AI returned an unexpected response format' });
    }

    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    req.log.info({ projectId, userId: req.user.id, tasksExtracted: tasks.length }, 'ai.meeting_notes_complete');

    return res.json({ tasks });
  } catch (err) {
    req.log.error({ projectId, userId: req.user.id, err: err.message }, 'ai.meeting_notes_failed');
    return res.status(500).json({ error: 'Failed to parse meeting notes' });
  }
});

// ── POST /api/projects/:projectId/ai/estimate ─────────────────────────────────
// Estimate effort and suggest a deadline for a task.
// Body: { title, description, priority }
router.post('/estimate', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return noApiKeyResponse(res);

  const { title, description, priority = 'medium' } = req.body;
  const { projectId } = req.params;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const client = getClient();
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `You are a software project estimation assistant.

Today's date: ${today}

Task details:
Title: ${title}
${description ? `Description: ${description}` : ''}
Priority: ${priority}

Estimate the effort required for this task and suggest a realistic deadline.
Consider typical software development complexity, testing, and review time.
For priority:
  - critical: complete ASAP (1-3 days)
  - high: soon (3-7 days)
  - medium: within a reasonable sprint (7-14 days)
  - low: when capacity allows (14-30 days)

Respond with a JSON object in this exact format (no prose, no markdown):
{
  "estimated_hours": 4,
  "suggested_deadline": "YYYY-MM-DD",
  "reasoning": "Brief explanation of the estimate"
}`;

    req.log.info({ projectId, userId: req.user.id, taskTitle: title, priority }, 'ai.estimate_requested');

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text;

    let parsed;
    try {
      parsed = extractJson(text);
    } catch {
      req.log.warn({ projectId, userId: req.user.id, rawResponse: text }, 'ai.estimate_parse_failed');
      return res.status(502).json({ error: 'AI returned an unexpected response format' });
    }

    // Validate and sanitize fields
    const estimated_hours = typeof parsed.estimated_hours === 'number' ? parsed.estimated_hours : null;
    const suggested_deadline = typeof parsed.suggested_deadline === 'string' ? parsed.suggested_deadline : null;
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    req.log.info({ projectId, userId: req.user.id, estimated_hours, suggested_deadline }, 'ai.estimate_complete');

    return res.json({ estimated_hours, suggested_deadline, reasoning });
  } catch (err) {
    req.log.error({ projectId, userId: req.user.id, err: err.message }, 'ai.estimate_failed');
    return res.status(500).json({ error: 'Failed to generate task estimate' });
  }
});

module.exports = router;
