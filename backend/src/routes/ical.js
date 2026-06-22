'use strict';

const express = require('express');
const { queryAll } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { APP_URL } = require('../config/env');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

function icsDate(d) {
  return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line) {
  // RFC 5545: max 75 octets per line, fold with CRLF + whitespace
  const max = 75;
  if (line.length <= max) return line;
  let result = '';
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      result += line.slice(i, i + max);
      i += max;
    } else {
      result += '\r\n ' + line.slice(i, i + max - 1);
      i += max - 1;
    }
  }
  return result;
}

// GET /api/projects/:projectId/ical.ics — download .ics file for all tasks with deadlines
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    const conditions = ['t.project_id = ?', 't.deadline IS NOT NULL'];
    const params = [req.params.projectId];
    if (status) { conditions.push('t.status = ?'); params.push(status); }

    const [project, tasks] = await Promise.all([
      queryAll('SELECT name FROM projects WHERE id = ?', [req.params.projectId]),
      queryAll(
        `SELECT t.id, t.title, t.description, t.deadline, t.status, t.priority, t.created_at, t.updated_at,
                u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY t.deadline ASC`,
        params
      ),
    ]);

    const projectName = project[0]?.name || 'Project';
    const appUrl = APP_URL || 'https://app.tickapp.io';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//Tick//${icsEscape(projectName)}//EN`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      foldLine(`X-WR-CALNAME:${icsEscape(projectName)} Tasks`),
      'X-WR-TIMEZONE:UTC',
    ];

    for (const t of tasks) {
      const uid = `task-${t.id}@tickapp.io`;
      const dtStart = icsDate(t.deadline);
      const dtEnd = icsDate(new Date(new Date(t.deadline).getTime() + 3600000)); // +1h
      const dtStamp = icsDate(new Date());
      const dtCreated = icsDate(t.created_at);
      const dtModified = icsDate(t.updated_at || t.created_at);

      const priority = { urgent: '1', high: '3', medium: '5', low: '9' }[t.priority] || '5';
      const statusIcs = { todo: 'NEEDS-ACTION', in_progress: 'IN-PROCESS', review: 'IN-PROCESS', done: 'COMPLETED' }[t.status] || 'NEEDS-ACTION';

      lines.push(
        'BEGIN:VEVENT',
        foldLine(`UID:${uid}`),
        foldLine(`DTSTAMP:${dtStamp}`),
        foldLine(`DTSTART;VALUE=DATE:${dtStart.slice(0, 8)}`),
        foldLine(`DTEND;VALUE=DATE:${dtEnd.slice(0, 8)}`),
        foldLine(`CREATED:${dtCreated}`),
        foldLine(`LAST-MODIFIED:${dtModified}`),
        foldLine(`SUMMARY:${icsEscape(t.title)}`),
        foldLine(`DESCRIPTION:${icsEscape(t.description || '')}${t.assignee_name ? `\\nAssignee: ${t.assignee_name}` : ''}\\nStatus: ${t.status}\\nPriority: ${t.priority}`),
        foldLine(`URL:${appUrl}/app/projects/${req.params.projectId}/board`),
        `PRIORITY:${priority}`,
        `STATUS:${statusIcs}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');
    const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_tasks.ics`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsContent);
  } catch (err) { res.status(500).json({ error: 'Failed to generate calendar' }); }
});

module.exports = router;
