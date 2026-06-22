const express = require('express');
const { queryAll } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { ANTHROPIC_API_KEY } = require('../config/env');
const logger = require('../config/logger');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/standup?date=YYYY-MM-DD&status=
router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    const today = date || new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0, 10);

    const conditions = ['t.project_id = ? AND t.parent_task_id IS NULL'];
    const params = [req.params.projectId];
    if (status) { conditions.push('t.status = ?'); params.push(status); }

    const tasks = await queryAll(`
      SELECT t.*, u.name as assignee_name, u.email as assignee_email, u.avatar_url as assignee_avatar,
             c.name as creator_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN users c ON c.id = t.created_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.name, t.priority DESC, t.deadline
    `, params);

    const tagRows = await Promise.all(tasks.map((t) =>
      queryAll('SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?', [t.id])
    ));

    tasks.forEach((t, i) => {
      t.tags = tagRows[i];
      t.is_overdue = t.deadline && t.deadline < today && t.status !== 'done';
      t.due_today  = t.deadline && t.deadline >= today && t.deadline < tomorrow;
    });

    const grouped = {};
    const unassigned = [];
    tasks.forEach((task) => {
      if (!task.assignee_id) {
        unassigned.push(task);
      } else {
        if (!grouped[task.assignee_id]) {
          grouped[task.assignee_id] = {
            user: { id: task.assignee_id, name: task.assignee_name, email: task.assignee_email, avatar_url: task.assignee_avatar },
            tasks: [],
            stats: { total: 0, done: 0, in_progress: 0, overdue: 0 },
          };
        }
        grouped[task.assignee_id].tasks.push(task);
        grouped[task.assignee_id].stats.total++;
        if (task.status === 'done')        grouped[task.assignee_id].stats.done++;
        if (task.status === 'in_progress') grouped[task.assignee_id].stats.in_progress++;
        if (task.is_overdue)               grouped[task.assignee_id].stats.overdue++;
      }
    });

    res.json({ date: today, groups: Object.values(grouped), unassigned });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, err: err.message }, 'standup.fetch_failed');
    res.status(500).json({ error: 'Failed to fetch standup data' });
  }
});

// POST /api/projects/:projectId/standup/digest
// Generates an AI narrative digest from the current standup data
router.post('/digest', async (req, res) => {
  try {
    const { date } = req.body;
    const today = date || new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0, 10);

    const tasks = await queryAll(`
      SELECT t.title, t.status, t.priority, t.deadline, t.parent_task_id,
             u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ? AND t.parent_task_id IS NULL
      ORDER BY u.name, t.priority DESC
    `, [req.params.projectId]);

    tasks.forEach((t) => {
      t.is_overdue = t.deadline && t.deadline < today && t.status !== 'done';
      t.due_today  = t.deadline && t.deadline >= today && t.deadline < tomorrow;
    });

    // Group by person for the prompt
    const byPerson = {};
    const unassigned = [];
    for (const t of tasks) {
      if (!t.assignee_name) { unassigned.push(t); continue; }
      if (!byPerson[t.assignee_name]) byPerson[t.assignee_name] = [];
      byPerson[t.assignee_name].push(t);
    }

    const totalTasks   = tasks.length;
    const doneTasks    = tasks.filter((t) => t.status === 'done').length;
    const inProgress   = tasks.filter((t) => t.status === 'in_progress').length;
    const overdueTasks = tasks.filter((t) => t.is_overdue);
    const dueTodayTasks = tasks.filter((t) => t.due_today);

    // Build a compact summary for the prompt
    const personLines = Object.entries(byPerson).map(([name, pts]) => {
      const done = pts.filter((t) => t.status === 'done').length;
      const wip  = pts.filter((t) => t.status === 'in_progress').map((t) => t.title);
      const od   = pts.filter((t) => t.is_overdue).map((t) => t.title);
      return `${name}: ${done}/${pts.length} done${wip.length ? `, working on: ${wip.slice(0,2).join(', ')}` : ''}${od.length ? `, OVERDUE: ${od.slice(0,2).join(', ')}` : ''}`;
    });

    if (ANTHROPIC_API_KEY) {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY });

      const prompt = `You are a project manager writing a concise async standup digest for the team.

Date: ${today}
Overall: ${doneTasks}/${totalTasks} tasks done, ${inProgress} in progress
${overdueTasks.length > 0 ? `Overdue (${overdueTasks.length}): ${overdueTasks.slice(0,3).map(t=>t.title).join(', ')}` : 'No overdue tasks'}
${dueTodayTasks.length > 0 ? `Due today: ${dueTodayTasks.slice(0,3).map(t=>t.title).join(', ')}` : ''}

Per-person summary:
${personLines.join('\n')}
${unassigned.length > 0 ? `\nUnassigned tasks: ${unassigned.length}` : ''}

Write a short standup digest (3-5 sentences) that:
1. States team progress concisely
2. Calls out any blockers or overdue items
3. Highlights what needs attention today
4. Is written in a friendly, direct tone (not robotic)

Respond with JSON:
{
  "digest": "The narrative paragraph here",
  "highlights": ["key win or progress point"],
  "blockers": ["item needing attention"],
  "mood": "on_track|at_risk|blocked"
}`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].text;
      try {
        const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
        req.log.info({ projectId: req.params.projectId }, 'standup.digest_generated');
        return res.json({ ...parsed, date: today, generated_by: 'ai' });
      } catch {
        return res.json({ digest: text, highlights: [], blockers: [], mood: 'on_track', date: today, generated_by: 'ai' });
      }
    }

    // Rule-based fallback
    let mood = 'on_track';
    const highlights = [];
    const blockers = [];

    if (overdueTasks.length > 0) {
      mood = overdueTasks.length > 2 ? 'blocked' : 'at_risk';
      blockers.push(`${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}: ${overdueTasks.slice(0,2).map(t=>t.title).join(', ')}`);
    }
    if (doneTasks > 0) {
      highlights.push(`${doneTasks} task${doneTasks > 1 ? 's' : ''} completed`);
    }
    if (dueTodayTasks.length > 0) {
      blockers.push(`${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today`);
    }

    const parts = [];
    parts.push(`Team progress: ${doneTasks}/${totalTasks} tasks done with ${inProgress} in progress.`);
    if (overdueTasks.length > 0) parts.push(`${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} overdue and need attention.`);
    else parts.push('No tasks are currently overdue.');
    if (dueTodayTasks.length > 0) parts.push(`${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today.`);

    res.json({ digest: parts.join(' '), highlights, blockers, mood, date: today, generated_by: 'rules' });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, err: err.message }, 'standup.digest_failed');
    res.status(500).json({ error: 'Failed to generate digest' });
  }
});

module.exports = router;
