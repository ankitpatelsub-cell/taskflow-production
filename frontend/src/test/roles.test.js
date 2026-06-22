import { describe, it, expect } from 'vitest';
import {
  ROLE_WEIGHTS, ROLE_LABELS, ROLE_COLORS, ROLE_DESCRIPTIONS, ALL_ROLES,
  hasMinRole, isAdminOrAbove, isSuperAdmin, isProjectManagerOrAbove,
} from '@/lib/roles';

// ─── ROLE_WEIGHTS ─────────────────────────────────────────────────────────────
describe('ROLE_WEIGHTS', () => {
  it('has entries for all 5 roles', () => {
    const expected = ['super_admin', 'admin', 'project_manager', 'member', 'viewer'];
    expected.forEach((r) => expect(ROLE_WEIGHTS).toHaveProperty(r));
  });

  it('super_admin has the highest weight', () => {
    const weights = Object.values(ROLE_WEIGHTS);
    expect(ROLE_WEIGHTS.super_admin).toBe(Math.max(...weights));
  });

  it('viewer has the lowest weight', () => {
    const weights = Object.values(ROLE_WEIGHTS);
    expect(ROLE_WEIGHTS.viewer).toBe(Math.min(...weights));
  });

  it('hierarchy order: super_admin > admin > project_manager > member > viewer', () => {
    expect(ROLE_WEIGHTS.super_admin).toBeGreaterThan(ROLE_WEIGHTS.admin);
    expect(ROLE_WEIGHTS.admin).toBeGreaterThan(ROLE_WEIGHTS.project_manager);
    expect(ROLE_WEIGHTS.project_manager).toBeGreaterThan(ROLE_WEIGHTS.member);
    expect(ROLE_WEIGHTS.member).toBeGreaterThan(ROLE_WEIGHTS.viewer);
  });

  it('all weights are distinct positive integers', () => {
    const vals = Object.values(ROLE_WEIGHTS);
    const unique = new Set(vals);
    expect(unique.size).toBe(vals.length);
    vals.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});

// ─── ROLE_LABELS ──────────────────────────────────────────────────────────────
describe('ROLE_LABELS', () => {
  it('has a human-readable label for each role', () => {
    Object.keys(ROLE_WEIGHTS).forEach((r) => {
      expect(ROLE_LABELS).toHaveProperty(r);
      expect(typeof ROLE_LABELS[r]).toBe('string');
      expect(ROLE_LABELS[r].length).toBeGreaterThan(0);
    });
  });

  it('labels are title-cased (not raw keys)', () => {
    expect(ROLE_LABELS.super_admin).not.toBe('super_admin');
    expect(ROLE_LABELS.project_manager).not.toBe('project_manager');
  });
});

// ─── ROLE_COLORS ──────────────────────────────────────────────────────────────
describe('ROLE_COLORS', () => {
  it('has color string for each role', () => {
    Object.keys(ROLE_WEIGHTS).forEach((r) => {
      expect(ROLE_COLORS).toHaveProperty(r);
      expect(typeof ROLE_COLORS[r]).toBe('string');
    });
  });
});

// ─── ALL_ROLES ────────────────────────────────────────────────────────────────
describe('ALL_ROLES', () => {
  it('is an array containing all 5 roles', () => {
    expect(Array.isArray(ALL_ROLES)).toBe(true);
    expect(ALL_ROLES).toHaveLength(5);
    Object.keys(ROLE_WEIGHTS).forEach((r) => expect(ALL_ROLES).toContain(r));
  });

  it('is ordered from highest to lowest privilege', () => {
    for (let i = 0; i < ALL_ROLES.length - 1; i++) {
      expect(ROLE_WEIGHTS[ALL_ROLES[i]]).toBeGreaterThan(ROLE_WEIGHTS[ALL_ROLES[i + 1]]);
    }
  });
});

// ─── hasMinRole() ─────────────────────────────────────────────────────────────
describe('hasMinRole()', () => {
  it('super_admin satisfies every role threshold', () => {
    ALL_ROLES.forEach((r) => expect(hasMinRole('super_admin', r)).toBe(true));
  });

  it('viewer only satisfies viewer threshold', () => {
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
    expect(hasMinRole('viewer', 'member')).toBe(false);
    expect(hasMinRole('viewer', 'project_manager')).toBe(false);
    expect(hasMinRole('viewer', 'admin')).toBe(false);
    expect(hasMinRole('viewer', 'super_admin')).toBe(false);
  });

  it('member satisfies viewer and member, not higher', () => {
    expect(hasMinRole('member', 'viewer')).toBe(true);
    expect(hasMinRole('member', 'member')).toBe(true);
    expect(hasMinRole('member', 'project_manager')).toBe(false);
  });

  it('returns false for null/undefined role', () => {
    expect(hasMinRole(null, 'viewer')).toBe(false);
    expect(hasMinRole(undefined, 'viewer')).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(hasMinRole('unknown', 'viewer')).toBe(false);
    expect(hasMinRole('guest', 'member')).toBe(false);
  });

  it('returns false when minRole is unknown (requires 999 weight)', () => {
    expect(hasMinRole('super_admin', 'unknown_role')).toBe(false);
  });
});

// ─── isAdminOrAbove() ─────────────────────────────────────────────────────────
describe('isAdminOrAbove()', () => {
  it('returns true for admin', () => {
    expect(isAdminOrAbove('admin')).toBe(true);
  });

  it('returns true for super_admin', () => {
    expect(isAdminOrAbove('super_admin')).toBe(true);
  });

  it('returns false for project_manager', () => {
    expect(isAdminOrAbove('project_manager')).toBe(false);
  });

  it('returns false for member', () => {
    expect(isAdminOrAbove('member')).toBe(false);
  });

  it('returns false for viewer', () => {
    expect(isAdminOrAbove('viewer')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isAdminOrAbove(null)).toBe(false);
    expect(isAdminOrAbove(undefined)).toBe(false);
  });
});

// ─── isSuperAdmin() ───────────────────────────────────────────────────────────
describe('isSuperAdmin()', () => {
  it('returns true only for super_admin', () => {
    expect(isSuperAdmin('super_admin')).toBe(true);
  });

  it('returns false for admin', () => {
    expect(isSuperAdmin('admin')).toBe(false);
  });

  it('returns false for all non-super_admin roles', () => {
    ['admin', 'project_manager', 'member', 'viewer'].forEach((r) => {
      expect(isSuperAdmin(r)).toBe(false);
    });
  });

  it('returns false for null/undefined', () => {
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

// ─── isProjectManagerOrAbove() ────────────────────────────────────────────────
describe('isProjectManagerOrAbove()', () => {
  it('returns true for project_manager', () => {
    expect(isProjectManagerOrAbove('project_manager')).toBe(true);
  });

  it('returns true for admin and super_admin', () => {
    expect(isProjectManagerOrAbove('admin')).toBe(true);
    expect(isProjectManagerOrAbove('super_admin')).toBe(true);
  });

  it('returns false for member', () => {
    expect(isProjectManagerOrAbove('member')).toBe(false);
  });

  it('returns false for viewer', () => {
    expect(isProjectManagerOrAbove('viewer')).toBe(false);
  });
});
