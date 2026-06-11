import { describe, it, expect } from 'vitest';

// Unit tests for the analytics route's projectParams/projectFilter derivation logic.
// These cover the bug where admin users with no workspace_id were passed [req.user.id]
// as params even though the SQL used '1=1' (no $1 placeholder).

function deriveProjectFilter(workspace_id, isAdmin, userId) {
  const projectFilter = workspace_id
    ? `p.workspace_id = $1`
    : isAdmin
      ? `1=1`
      : `p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
  const projectParams = workspace_id ? [workspace_id] : isAdmin ? [] : [userId];
  return { projectFilter, projectParams };
}

// ─── projectFilter + projectParams derivation ──────────────────────────────────
describe('analytics projectFilter / projectParams', () => {
  const userId = 'user-abc-123';
  const workspaceId = 'ws-xyz-456';

  describe('admin with no workspace_id', () => {
    it('uses 1=1 filter', () => {
      const { projectFilter } = deriveProjectFilter(undefined, true, userId);
      expect(projectFilter).toBe('1=1');
    });

    it('returns empty params array (no $1 placeholder)', () => {
      const { projectParams } = deriveProjectFilter(undefined, true, userId);
      expect(projectParams).toEqual([]);
    });

    it('same result for null vs undefined workspace_id', () => {
      const a = deriveProjectFilter(null, true, userId);
      const b = deriveProjectFilter(undefined, true, userId);
      expect(a.projectParams).toEqual(b.projectParams);
      expect(a.projectFilter).toBe(b.projectFilter);
    });
  });

  describe('any role with workspace_id', () => {
    it('uses workspace filter with $1', () => {
      const { projectFilter } = deriveProjectFilter(workspaceId, false, userId);
      expect(projectFilter).toBe('p.workspace_id = $1');
    });

    it('passes workspace_id as the only param', () => {
      const { projectParams } = deriveProjectFilter(workspaceId, false, userId);
      expect(projectParams).toEqual([workspaceId]);
    });

    it('workspace_id takes priority over admin flag', () => {
      const { projectFilter, projectParams } = deriveProjectFilter(workspaceId, true, userId);
      expect(projectFilter).toBe('p.workspace_id = $1');
      expect(projectParams).toEqual([workspaceId]);
    });
  });

  describe('non-admin with no workspace_id', () => {
    it('uses project_members subquery with $1', () => {
      const { projectFilter } = deriveProjectFilter(undefined, false, userId);
      expect(projectFilter).toContain('project_members');
      expect(projectFilter).toContain('$1');
    });

    it('passes user_id as the only param', () => {
      const { projectParams } = deriveProjectFilter(undefined, false, userId);
      expect(projectParams).toEqual([userId]);
    });
  });

  describe('params-placeholder consistency', () => {
    it('when filter contains $1, params array is non-empty', () => {
      const cases = [
        deriveProjectFilter(workspaceId, false, userId),
        deriveProjectFilter(undefined, false, userId),
      ];
      cases.forEach(({ projectFilter, projectParams }) => {
        if (projectFilter.includes('$1')) {
          expect(projectParams.length).toBeGreaterThan(0);
        }
      });
    });

    it('when filter is 1=1, params array is empty', () => {
      const { projectFilter, projectParams } = deriveProjectFilter(undefined, true, userId);
      expect(projectFilter).not.toContain('$1');
      expect(projectParams).toHaveLength(0);
    });
  });
});

// ─── isAdmin detection logic ───────────────────────────────────────────────────
describe('isAdmin detection', () => {
  const adminRoles = ['admin', 'super_admin'];

  function isAdmin(role) {
    return adminRoles.includes(role);
  }

  it('admin role is detected as admin', () => {
    expect(isAdmin('admin')).toBe(true);
  });

  it('super_admin role is detected as admin', () => {
    expect(isAdmin('super_admin')).toBe(true);
  });

  it('member role is not admin', () => {
    expect(isAdmin('member')).toBe(false);
  });

  it('viewer role is not admin', () => {
    expect(isAdmin('viewer')).toBe(false);
  });

  it('project_manager role is not admin', () => {
    expect(isAdmin('project_manager')).toBe(false);
  });

  it('undefined role is not admin', () => {
    expect(isAdmin(undefined)).toBe(false);
  });
});
