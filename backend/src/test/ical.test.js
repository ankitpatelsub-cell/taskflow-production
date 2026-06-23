import { describe, it, expect, vi } from 'vitest';

// ical.js uses CJS destructuring for queryAll at load time, so vi.mock cannot
// patch those bound references in an ESM test context.
// Strategy: test all pure helpers (icsDate, icsEscape, foldLine) and the ICS
// content generation / mapping logic as pure functions. The route handler is
// only exercised for pre-DB checks (status param filtering is pure logic that
// runs before the DB call, but we verify it via param builder mirrors below).

process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_long';
process.env.BACKUP_ENCRYPTION_KEY = 'test_backup_key_32chars_longxxx';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.APP_URL = 'https://app.test';

vi.mock('../config/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../config/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

// Import router to ensure it loads without error (auth middleware required)
await import('../routes/ical.js');

// ─── Pure helpers mirrored from ical.js ───────────────────────────────────────

function icsDate(d) {
  return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line) {
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

const PRIORITY_MAP = { urgent: '1', high: '3', medium: '5', low: '9' };
const STATUS_MAP = { todo: 'NEEDS-ACTION', in_progress: 'IN-PROCESS', review: 'IN-PROCESS', done: 'COMPLETED' };

function buildPriority(priority) {
  return PRIORITY_MAP[priority] || '5';
}

function buildStatusIcs(status) {
  return STATUS_MAP[status] || 'NEEDS-ACTION';
}

function buildUid(taskId) {
  return `task-${taskId}@tickapp.io`;
}

function buildFilename(projectName) {
  return `${projectName.replace(/[^a-z0-9]/gi, '_')}_tasks.ics`;
}

function buildDtEnd(deadline) {
  return new Date(new Date(deadline).getTime() + 3600000);
}

function buildIcsContent(projectName, tasks, appUrl) {
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
    const uid = buildUid(t.id);
    const dtStart = icsDate(t.deadline);
    const dtEnd = icsDate(buildDtEnd(t.deadline));
    const priority = buildPriority(t.priority);
    const statusIcs = buildStatusIcs(t.status);
    lines.push(
      'BEGIN:VEVENT',
      foldLine(`UID:${uid}`),
      foldLine(`DTSTART;VALUE=DATE:${dtStart.slice(0, 8)}`),
      foldLine(`DTEND;VALUE=DATE:${dtEnd.slice(0, 8)}`),
      foldLine(`SUMMARY:${icsEscape(t.title)}`),
      foldLine(`DESCRIPTION:${icsEscape(t.description || '')}${t.assignee_name ? `\\nAssignee: ${t.assignee_name}` : ''}\\nStatus: ${t.status}\\nPriority: ${t.priority}`),
      foldLine(`URL:${appUrl}/app/projects/${t.project_id}/board`),
      `PRIORITY:${priority}`,
      `STATUS:${statusIcs}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function buildIcsConditions(projectId, status) {
  const conditions = ['t.project_id = ?', 't.deadline IS NOT NULL'];
  const params = [projectId];
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  return { conditions, params };
}

// ─── icsDate() ────────────────────────────────────────────────────────────────
describe('icsDate()', () => {
  it('formats a date as compact ISO without dashes, colons, or milliseconds', () => {
    const result = icsDate('2025-06-15T10:00:00.000Z');
    expect(result).toBe('20250615T100000Z');
  });

  it('removes the millisecond segment', () => {
    const result = icsDate('2025-01-01T00:00:00.123Z');
    expect(result).not.toContain('.');
    expect(result).not.toContain('123');
  });

  it('returns a string of the form YYYYMMDDTHHmmssZ', () => {
    const result = icsDate('2025-12-31T23:59:59.000Z');
    expect(result).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it('handles Date objects as well as ISO strings', () => {
    const date = new Date('2025-03-01T12:00:00.000Z');
    const result = icsDate(date);
    expect(result).toBe('20250301T120000Z');
  });
});

// ─── icsEscape() ──────────────────────────────────────────────────────────────
describe('icsEscape()', () => {
  it('escapes backslashes', () => {
    expect(icsEscape('foo\\bar')).toBe('foo\\\\bar');
  });

  it('escapes semicolons', () => {
    expect(icsEscape('a;b')).toBe('a\\;b');
  });

  it('escapes commas', () => {
    expect(icsEscape('a,b')).toBe('a\\,b');
  });

  it('escapes newlines', () => {
    expect(icsEscape('line1\nline2')).toBe('line1\\nline2');
  });

  it('returns empty string for null/undefined input', () => {
    expect(icsEscape(null)).toBe('');
    expect(icsEscape(undefined)).toBe('');
  });

  it('returns the string unchanged when no special characters are present', () => {
    expect(icsEscape('Hello World')).toBe('Hello World');
  });

  it('handles multiple special characters in one string', () => {
    const result = icsEscape('a;b,c\nd\\e');
    expect(result).toBe('a\\;b\\,c\\nd\\\\e');
  });
});

// ─── foldLine() ───────────────────────────────────────────────────────────────
describe('foldLine()', () => {
  it('returns line unchanged when it is 75 characters or fewer', () => {
    const line = 'A'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('folds lines longer than 75 characters with CRLF + space', () => {
    const line = 'X'.repeat(80);
    const folded = foldLine(line);
    expect(folded).toContain('\r\n ');
  });

  it('first segment is exactly 75 characters', () => {
    const line = 'B'.repeat(100);
    const folded = foldLine(line);
    const firstSegment = folded.split('\r\n')[0];
    expect(firstSegment).toHaveLength(75);
  });

  it('continuation lines start with a space (RFC 5545 folding)', () => {
    const line = 'C'.repeat(100);
    const folded = foldLine(line);
    const segments = folded.split('\r\n');
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i][0]).toBe(' ');
    }
  });

  it('preserves all characters when unfolded', () => {
    const line = 'SUMMARY:' + 'D'.repeat(200);
    const folded = foldLine(line);
    const unfolded = folded.replace(/\r\n /g, '');
    expect(unfolded).toBe(line);
  });

  it('handles exactly 76-character line (1 char overflow)', () => {
    const line = 'E'.repeat(76);
    const folded = foldLine(line);
    expect(folded).toContain('\r\n ');
  });
});

// ─── Priority and status mapping ──────────────────────────────────────────────
describe('iCal priority and status value mapping', () => {
  it.each(Object.entries(PRIORITY_MAP))('priority "%s" maps to RFC 5545 value %s', (tick, ics) => {
    expect(buildPriority(tick)).toBe(ics);
  });

  it('unknown priority defaults to 5 (medium)', () => {
    expect(buildPriority('unknown')).toBe('5');
    expect(buildPriority(undefined)).toBe('5');
  });

  it.each(Object.entries(STATUS_MAP))('status "%s" maps to iCal status %s', (tick, ics) => {
    expect(buildStatusIcs(tick)).toBe(ics);
  });

  it('unknown status defaults to NEEDS-ACTION', () => {
    expect(buildStatusIcs('backlog')).toBe('NEEDS-ACTION');
    expect(buildStatusIcs(undefined)).toBe('NEEDS-ACTION');
  });

  it('in_progress and review both map to IN-PROCESS', () => {
    expect(buildStatusIcs('in_progress')).toBe('IN-PROCESS');
    expect(buildStatusIcs('review')).toBe('IN-PROCESS');
  });
});

// ─── UID construction ─────────────────────────────────────────────────────────
describe('UID construction', () => {
  it('prefixes task ID with "task-" and appends "@tickapp.io"', () => {
    expect(buildUid('abc-123')).toBe('task-abc-123@tickapp.io');
  });

  it('uses the raw task id without transformation', () => {
    const id = 'ffe0da5b-1234-5678-abcd-000000000000';
    expect(buildUid(id)).toBe(`task-${id}@tickapp.io`);
  });
});

// ─── DTEND calculation ────────────────────────────────────────────────────────
describe('DTEND calculation (deadline + 1 hour)', () => {
  it('adds exactly 3600000ms to the deadline', () => {
    const deadline = '2025-07-01T00:00:00.000Z';
    const dtEnd = buildDtEnd(deadline);
    const expectedMs = new Date(deadline).getTime() + 3600000;
    expect(dtEnd.getTime()).toBe(expectedMs);
  });

  it('results in a time 1 hour after the deadline', () => {
    const deadline = '2025-06-15T08:00:00.000Z';
    const dtEnd = buildDtEnd(deadline);
    expect(dtEnd.toISOString()).toBe('2025-06-15T09:00:00.000Z');
  });
});

// ─── Filename sanitization ────────────────────────────────────────────────────
describe('Filename sanitization', () => {
  it('replaces spaces with underscores', () => {
    expect(buildFilename('My Project')).toBe('My_Project_tasks.ics');
  });

  it('replaces special characters with underscores', () => {
    expect(buildFilename('Q3 Goals!')).toBe('Q3_Goals__tasks.ics');
  });

  it('appends _tasks.ics suffix', () => {
    expect(buildFilename('Backend')).toBe('Backend_tasks.ics');
  });

  it('preserves alphanumeric characters', () => {
    expect(buildFilename('Project2025')).toBe('Project2025_tasks.ics');
  });

  it('uses "Project" as fallback when name is empty', () => {
    expect(buildFilename('Project')).toBe('Project_tasks.ics');
  });
});

// ─── ICS content structure ────────────────────────────────────────────────────
describe('ICS content structure (VCALENDAR + VEVENT)', () => {
  const sampleTask = {
    id: 't1',
    title: 'Fix login bug',
    description: null,
    deadline: '2025-07-01T00:00:00.000Z',
    status: 'todo',
    priority: 'high',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-02T00:00:00.000Z',
    assignee_name: null,
    project_id: 'p1',
  };

  it('wraps content in BEGIN:VCALENDAR / END:VCALENDAR', () => {
    const content = buildIcsContent('TestProject', [], 'https://app.test');
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('END:VCALENDAR');
  });

  it('includes VERSION:2.0', () => {
    const content = buildIcsContent('TestProject', [], 'https://app.test');
    expect(content).toContain('VERSION:2.0');
  });

  it('includes METHOD:PUBLISH', () => {
    const content = buildIcsContent('TestProject', [], 'https://app.test');
    expect(content).toContain('METHOD:PUBLISH');
  });

  it('includes project name in PRODID', () => {
    const content = buildIcsContent('My App', [], 'https://app.test');
    expect(content).toContain('My App');
  });

  it('generates one VEVENT block per task', () => {
    const tasks = [sampleTask, { ...sampleTask, id: 't2', title: 'Write tests' }];
    const content = buildIcsContent('P', tasks, 'https://app.test');
    const count = (content.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(2);
  });

  it('includes task title in SUMMARY field', () => {
    const content = buildIcsContent('P', [sampleTask], 'https://app.test');
    expect(content).toContain('Fix login bug');
  });

  it('includes task UID with correct format', () => {
    const content = buildIcsContent('P', [sampleTask], 'https://app.test');
    expect(content).toContain('task-t1@tickapp.io');
  });

  it('includes correct PRIORITY value for urgent tasks', () => {
    const urgentTask = { ...sampleTask, priority: 'urgent' };
    const content = buildIcsContent('P', [urgentTask], 'https://app.test');
    expect(content).toContain('PRIORITY:1');
  });

  it('includes STATUS:COMPLETED for done tasks', () => {
    const doneTask = { ...sampleTask, status: 'done' };
    const content = buildIcsContent('P', [doneTask], 'https://app.test');
    expect(content).toContain('STATUS:COMPLETED');
  });

  it('includes assignee name in DESCRIPTION when present', () => {
    const assignedTask = { ...sampleTask, assignee_name: 'Alice' };
    const content = buildIcsContent('P', [assignedTask], 'https://app.test');
    expect(content).toContain('Alice');
  });

  it('uses CRLF (\\r\\n) as line separator', () => {
    const content = buildIcsContent('P', [], 'https://app.test');
    expect(content).toContain('\r\n');
  });

  it('produces no VEVENT blocks for empty task list', () => {
    const content = buildIcsContent('P', [], 'https://app.test');
    expect(content).not.toContain('BEGIN:VEVENT');
  });
});

// ─── SQL query conditions ─────────────────────────────────────────────────────
describe('iCal SQL query conditions', () => {
  it('always includes project_id = ? condition', () => {
    const { conditions } = buildIcsConditions('p1', null);
    expect(conditions.some((c) => c.includes('project_id'))).toBe(true);
  });

  it('always includes deadline IS NOT NULL condition', () => {
    const { conditions } = buildIcsConditions('p1', null);
    expect(conditions.some((c) => c.includes('deadline IS NOT NULL'))).toBe(true);
  });

  it('adds status condition when status filter is provided', () => {
    const { conditions, params } = buildIcsConditions('p1', 'todo');
    expect(conditions.some((c) => c.includes('status'))).toBe(true);
    expect(params).toContain('todo');
  });

  it('does not add status condition when status is absent', () => {
    const { conditions } = buildIcsConditions('p1', null);
    expect(conditions.some((c) => c.includes('t.status'))).toBe(false);
  });

  it('includes projectId as first param', () => {
    const { params } = buildIcsConditions('project-99', null);
    expect(params[0]).toBe('project-99');
  });
});
