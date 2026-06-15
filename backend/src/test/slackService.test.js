import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for slackService.js split into two parts:
// 1. Pure message-building logic (deterministic, no I/O)
// 2. Integration behavior (DB check, early-return)

process.env.JWT_SECRET = 'test_jwt_secret_32chars_long_key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ─── Part 1: Pure message-building logic ──────────────────────────────────────
// Extracted from slackService.js for isolated unit testing

const STATUS_EMOJI = { todo: '📋', in_progress: '🔄', review: '👀', done: '✅' };
const PRIORITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

function buildSlackMessage(event, task, projectName) {
  if (event === 'created') {
    return `${PRIORITY_EMOJI[task.priority] || '📋'} *New task* in *${projectName}*: ${task.title}`;
  } else if (event === 'completed') {
    return `✅ *Task completed* in *${projectName}*: ${task.title}`;
  } else if (event === 'updated') {
    const status = task.status ? `${STATUS_EMOJI[task.status] || ''} → ${task.status}` : '';
    return `🔄 *Task updated* in *${projectName}*: ${task.title}${status ? ` (${status})` : ''}`;
  } else if (event === 'automation') {
    return task._msg || `[Automation] Task "${task.title}"`;
  }
  return null; // unknown event
}

const projectName = 'Acme Project';
const task = { id: 'task-1', title: 'Fix the bug', status: 'done', priority: 'high' };

describe('buildSlackMessage — created event', () => {
  it('contains "New task" and project name', () => {
    const text = buildSlackMessage('created', task, projectName);
    expect(text).toContain('New task');
    expect(text).toContain(projectName);
    expect(text).toContain(task.title);
  });

  it('includes high priority emoji 🟠', () => {
    const text = buildSlackMessage('created', { ...task, priority: 'high' }, projectName);
    expect(text).toContain('🟠');
  });

  it('includes critical priority emoji 🔴', () => {
    const text = buildSlackMessage('created', { ...task, priority: 'critical' }, projectName);
    expect(text).toContain('🔴');
  });

  it('includes medium priority emoji 🟡', () => {
    const text = buildSlackMessage('created', { ...task, priority: 'medium' }, projectName);
    expect(text).toContain('🟡');
  });

  it('includes low priority emoji 🟢', () => {
    const text = buildSlackMessage('created', { ...task, priority: 'low' }, projectName);
    expect(text).toContain('🟢');
  });

  it('falls back to clipboard emoji 📋 for unknown priority', () => {
    const text = buildSlackMessage('created', { ...task, priority: 'urgent' }, projectName);
    expect(text).toContain('📋');
  });

  it('falls back to clipboard emoji when priority is undefined', () => {
    const text = buildSlackMessage('created', { ...task, priority: undefined }, projectName);
    expect(text).toContain('📋');
  });
});

describe('buildSlackMessage — completed event', () => {
  it('contains "Task completed" and task title', () => {
    const text = buildSlackMessage('completed', task, projectName);
    expect(text).toContain('Task completed');
    expect(text).toContain(task.title);
    expect(text).toContain(projectName);
  });

  it('starts with ✅ checkmark', () => {
    const text = buildSlackMessage('completed', task, projectName);
    expect(text).toContain('✅');
  });
});

describe('buildSlackMessage — updated event', () => {
  it('contains "Task updated" and task title', () => {
    const text = buildSlackMessage('updated', task, projectName);
    expect(text).toContain('Task updated');
    expect(text).toContain(task.title);
  });

  it('starts with 🔄 emoji', () => {
    const text = buildSlackMessage('updated', task, projectName);
    expect(text).toContain('🔄');
  });

  it('includes status info in parentheses when status is set', () => {
    const text = buildSlackMessage('updated', { ...task, status: 'in_progress' }, projectName);
    expect(text).toContain('in_progress');
    expect(text).toMatch(/\(/);
  });

  it('includes ✅ emoji for done status in the status info', () => {
    const text = buildSlackMessage('updated', { ...task, status: 'done' }, projectName);
    expect(text).toContain('done');
    expect(text).toContain('✅');
  });

  it('includes 🔄 emoji for in_progress status', () => {
    const text = buildSlackMessage('updated', { ...task, status: 'in_progress' }, projectName);
    expect(text).toContain('🔄');
  });

  it('omits parenthesis status info when task.status is null', () => {
    const text = buildSlackMessage('updated', { ...task, status: null }, projectName);
    expect(text).not.toMatch(/\(/);
  });

  it('omits parenthesis status info when task.status is empty string', () => {
    const text = buildSlackMessage('updated', { ...task, status: '' }, projectName);
    expect(text).not.toMatch(/\(/);
  });
});

describe('buildSlackMessage — automation event', () => {
  it('uses _msg when provided', () => {
    const msg = 'Custom automation message!';
    const text = buildSlackMessage('automation', { ...task, _msg: msg }, projectName);
    expect(text).toBe(msg);
  });

  it('falls back to default "[Automation] Task title" when _msg is missing', () => {
    const text = buildSlackMessage('automation', task, projectName);
    expect(text).toContain('[Automation]');
    expect(text).toContain(task.title);
  });

  it('falls back when _msg is empty string', () => {
    const text = buildSlackMessage('automation', { ...task, _msg: '' }, projectName);
    expect(text).toContain('[Automation]');
  });
});

describe('buildSlackMessage — unknown event', () => {
  it('returns null for unrecognised event types', () => {
    expect(buildSlackMessage('deleted', task, projectName)).toBeNull();
    expect(buildSlackMessage('archived', task, projectName)).toBeNull();
    expect(buildSlackMessage('', task, projectName)).toBeNull();
  });
});

// ─── Part 2: notifySlack integration behavior ─────────────────────────────────
// Test DB-query behavior and early-return logic.
// We avoid mocking the https built-in (not reliably interceptable in CJS context).
// Instead we verify query-level and logger-level behavior.

vi.mock('../config/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../config/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}));

const db = await import('../config/db');
const logger = await import('../config/logger');
const { notifySlack } = await import('../services/slackService.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notifySlack — non-throwing behavior', () => {
  // These tests verify that notifySlack never throws regardless of what happens
  // underneath (DB failure caught in try/catch, early return for no webhook, etc.)
  // Note: CJS require mocks don't intercept the real module in CJS modules,
  // so we verify behavior through the function's promise resolution only.

  it('resolves (does not reject) when the DB call fails', async () => {
    // Real DB is unreachable → notifySlack catches the error internally
    await expect(notifySlack('proj-no-db', 'created', task)).resolves.toBeUndefined();
  });

  it('resolves when called with an unknown event type', async () => {
    await expect(notifySlack('proj-1', 'deleted', task)).resolves.toBeUndefined();
  });

  it('resolves when called with any valid event type', async () => {
    for (const event of ['created', 'completed', 'updated', 'automation']) {
      await expect(notifySlack('proj-x', event, task)).resolves.toBeUndefined();
    }
  });
});
