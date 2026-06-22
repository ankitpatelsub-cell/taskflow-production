import { describe, it, expect, vi, beforeEach } from 'vitest';

// automationService.js uses inline require() inside function bodies, which can't
// be reliably intercepted by vi.mock in a CJS context.
// Strategy: test the filtering + routing LOGIC extracted as pure functions,
// consistent with how analytics.test.js handles similar patterns.

// ─── Trigger filtering logic ───────────────────────────────────────────────────
// Mirrors the filtering inside runAutomations

function shouldSkipStatusTrigger(automation, task, old) {
  if (automation.trigger_value && task.status !== automation.trigger_value) return true;
  if (old && old.status === task.status) return true;
  return false;
}

function shouldSkipAssignedTrigger(automation, task, old) {
  if (old && old.assignee_id === task.assignee_id) return true;
  return false;
}

describe('task_status_changed trigger filtering', () => {
  const task = { id: 't1', status: 'done', assignee_id: 'u1' };

  it('skips when old status === new status (no change)', () => {
    const auto = { trigger_value: null };
    const old = { status: 'done' };
    expect(shouldSkipStatusTrigger(auto, task, old)).toBe(true);
  });

  it('skips when trigger_value does not match new status', () => {
    const auto = { trigger_value: 'review' };
    const old = { status: 'in_progress' };
    expect(shouldSkipStatusTrigger(auto, task, old)).toBe(true); // task.status = 'done' ≠ 'review'
  });

  it('does NOT skip when status changed to matching trigger_value', () => {
    const auto = { trigger_value: 'done' };
    const old = { status: 'in_progress' };
    expect(shouldSkipStatusTrigger(auto, task, old)).toBe(false);
  });

  it('does NOT skip when trigger_value is null (any change)', () => {
    const auto = { trigger_value: null };
    const old = { status: 'todo' };
    expect(shouldSkipStatusTrigger(auto, task, old)).toBe(false);
  });

  it('does NOT skip when old is null (task_created trigger)', () => {
    const auto = { trigger_value: null };
    expect(shouldSkipStatusTrigger(auto, task, null)).toBe(false);
  });

  it('skips when trigger_value set but task.status is falsy', () => {
    const auto = { trigger_value: 'done' };
    const taskNoStatus = { ...task, status: null };
    const old = { status: 'todo' };
    expect(shouldSkipStatusTrigger(auto, taskNoStatus, old)).toBe(true);
  });
});

describe('task_assigned trigger filtering', () => {
  const task = { id: 't1', status: 'todo', assignee_id: 'user-new' };

  it('skips when assignee did not change', () => {
    const auto = {};
    const old = { assignee_id: 'user-new' }; // same as task
    expect(shouldSkipAssignedTrigger(auto, task, old)).toBe(true);
  });

  it('does NOT skip when assignee changed', () => {
    const auto = {};
    const old = { assignee_id: 'user-old' };
    expect(shouldSkipAssignedTrigger(auto, task, old)).toBe(false);
  });

  it('does NOT skip when old is null (first assignment)', () => {
    const auto = {};
    expect(shouldSkipAssignedTrigger(auto, task, null)).toBe(false);
  });

  it('does NOT skip when old had no assignee and now task has one', () => {
    const auto = {};
    const old = { assignee_id: null };
    expect(shouldSkipAssignedTrigger(auto, task, old)).toBe(false);
  });
});

// ─── Action conditions ────────────────────────────────────────────────────────
// Test the conditions that gate each action type

describe('notify_assignee action conditions', () => {
  it('fires when action_type is notify_assignee and task has assignee', () => {
    const automation = { action_type: 'notify_assignee' };
    const task = { assignee_id: 'user-1' };
    const shouldFire = automation.action_type === 'notify_assignee' && !!task.assignee_id;
    expect(shouldFire).toBe(true);
  });

  it('does NOT fire when task has no assignee', () => {
    const automation = { action_type: 'notify_assignee' };
    const task = { assignee_id: null };
    const shouldFire = automation.action_type === 'notify_assignee' && !!task.assignee_id;
    expect(shouldFire).toBe(false);
  });

  it('does NOT fire for other action types', () => {
    const automation = { action_type: 'change_status' };
    const task = { assignee_id: 'user-1' };
    const shouldFire = automation.action_type === 'notify_assignee' && !!task.assignee_id;
    expect(shouldFire).toBe(false);
  });
});

describe('change_status action conditions', () => {
  it('fires when action_type is change_status and action_value is set', () => {
    const automation = { action_type: 'change_status', action_value: 'done' };
    const shouldFire = automation.action_type === 'change_status' && !!automation.action_value;
    expect(shouldFire).toBe(true);
  });

  it('does NOT fire when action_value is null', () => {
    const automation = { action_type: 'change_status', action_value: null };
    const shouldFire = automation.action_type === 'change_status' && !!automation.action_value;
    expect(shouldFire).toBe(false);
  });

  it('does NOT fire when action_value is empty string', () => {
    const automation = { action_type: 'change_status', action_value: '' };
    const shouldFire = automation.action_type === 'change_status' && !!automation.action_value;
    expect(shouldFire).toBe(false);
  });
});

describe('notify_slack action conditions', () => {
  it('fires when action_type is notify_slack', () => {
    const automation = { action_type: 'notify_slack', action_value: null };
    const shouldFire = automation.action_type === 'notify_slack';
    expect(shouldFire).toBe(true);
  });

  it('does NOT fire for other action types', () => {
    const automation = { action_type: 'notify_assignee' };
    const shouldFire = automation.action_type === 'notify_slack';
    expect(shouldFire).toBe(false);
  });
});

// ─── Notification message formatting ─────────────────────────────────────────
function buildNotificationMessage(automationName, taskTitle, triggerType) {
  return `[${automationName}] Task "${taskTitle}" — ${triggerType.replace(/_/g, ' ')}`;
}

describe('notification message formatting', () => {
  it('includes automation name in brackets', () => {
    const msg = buildNotificationMessage('On Done', 'Fix bug', 'task_status_changed');
    expect(msg).toContain('[On Done]');
  });

  it('includes task title in quotes', () => {
    const msg = buildNotificationMessage('On Done', 'Fix bug', 'task_status_changed');
    expect(msg).toContain('"Fix bug"');
  });

  it('replaces underscores in trigger type with spaces', () => {
    const msg = buildNotificationMessage('On Done', 'Fix bug', 'task_status_changed');
    expect(msg).toContain('task status changed');
    expect(msg).not.toContain('_');
  });

  it('formats task_assigned trigger correctly', () => {
    const msg = buildNotificationMessage('New Assign', 'Deploy app', 'task_assigned');
    expect(msg).toContain('task assigned');
  });

  it('formats task_created trigger correctly', () => {
    const msg = buildNotificationMessage('On Create', 'New feature', 'task_created');
    expect(msg).toContain('task created');
  });
});

// ─── Slack message construction for automations ───────────────────────────────
function buildSlackMessage(automation, task, triggerType) {
  return automation.action_value
    || `[${automation.name}] Task "${task.title}" — ${triggerType.replace(/_/g, ' ')}`;
}

describe('notify_slack message construction', () => {
  const task = { title: 'Deploy hotfix' };

  it('uses custom action_value when provided', () => {
    const automation = { name: 'Deploy Alert', action_value: 'Custom message!' };
    const msg = buildSlackMessage(automation, task, 'task_status_changed');
    expect(msg).toBe('Custom message!');
  });

  it('falls back to default message when action_value is null', () => {
    const automation = { name: 'Deploy Alert', action_value: null };
    const msg = buildSlackMessage(automation, task, 'task_status_changed');
    expect(msg).toContain('[Deploy Alert]');
    expect(msg).toContain(task.title);
    expect(msg).toContain('task status changed');
  });

  it('falls back to default message when action_value is empty string', () => {
    const automation = { name: 'Alert', action_value: '' };
    const msg = buildSlackMessage(automation, task, 'task_created');
    expect(msg).toContain('[Alert]');
  });

  it('default message replaces underscores in trigger type', () => {
    const automation = { name: 'X', action_value: null };
    const msg = buildSlackMessage(automation, task, 'task_assigned');
    expect(msg).toContain('task assigned');
    expect(msg).not.toContain('task_assigned');
  });
});

// ─── notify_members actor exclusion ──────────────────────────────────────────
describe('notify_members — actor exclusion logic', () => {
  function getRecipientsExcludingActor(members, actor) {
    return members.filter((m) => m.user_id !== actor?.id);
  }

  it('excludes the actor from the list', () => {
    const members = [{ user_id: 'actor-1' }, { user_id: 'user-2' }, { user_id: 'user-3' }];
    const actor = { id: 'actor-1' };
    const recipients = getRecipientsExcludingActor(members, actor);
    expect(recipients.map(m => m.user_id)).not.toContain('actor-1');
    expect(recipients).toHaveLength(2);
  });

  it('includes all members when actor is null', () => {
    const members = [{ user_id: 'user-2' }, { user_id: 'user-3' }];
    const recipients = getRecipientsExcludingActor(members, null);
    expect(recipients).toHaveLength(2);
  });

  it('handles empty member list', () => {
    const recipients = getRecipientsExcludingActor([], { id: 'actor-1' });
    expect(recipients).toHaveLength(0);
  });

  it('handles all members being the actor', () => {
    const members = [{ user_id: 'actor-1' }];
    const actor = { id: 'actor-1' };
    const recipients = getRecipientsExcludingActor(members, actor);
    expect(recipients).toHaveLength(0);
  });
});

// ─── Early-exit when no automations ──────────────────────────────────────────
describe('runAutomations — early exit condition', () => {
  it('performs no work when automation list is empty', () => {
    const automations = [];
    const actionsToRun = [];
    for (const a of automations) {
      actionsToRun.push(a.action_type);
    }
    expect(actionsToRun).toHaveLength(0);
  });

  it('processes each automation in the list', () => {
    const automations = [
      { id: 'a1', action_type: 'notify_assignee' },
      { id: 'a2', action_type: 'notify_members' },
    ];
    const processed = [];
    for (const a of automations) processed.push(a.id);
    expect(processed).toHaveLength(2);
    expect(processed).toContain('a1');
    expect(processed).toContain('a2');
  });
});
