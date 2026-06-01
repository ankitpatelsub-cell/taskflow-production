// ── Role definitions ──────────────────────────────────────────────────────────
export const ROLE_WEIGHTS = {
  super_admin:     5,
  admin:           4,
  project_manager: 3,
  member:          2,
  viewer:          1,
};

export const ROLE_LABELS = {
  super_admin:     'Super Admin',
  admin:           'Admin',
  project_manager: 'Project Manager',
  member:          'Member',
  viewer:          'Viewer',
};

export const ROLE_COLORS = {
  super_admin:     'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin:           'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  member:          'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  viewer:          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export const ROLE_DESCRIPTIONS = {
  super_admin:     'Full system access including DB backups & restore',
  admin:           'User management, create projects, all workspace access',
  project_manager: 'Manage assigned projects: settings, members, tasks',
  member:          'Create and edit tasks in assigned projects',
  viewer:          'Read-only access to assigned projects',
};

/** All roles in descending order */
export const ALL_ROLES = ['super_admin', 'admin', 'project_manager', 'member', 'viewer'];

/** True if userRole meets or exceeds minRole */
export function hasMinRole(userRole, minRole) {
  return (ROLE_WEIGHTS[userRole] || 0) >= (ROLE_WEIGHTS[minRole] || 999);
}

export const isAdminOrAbove       = (role) => hasMinRole(role, 'admin');
export const isSuperAdmin         = (role) => role === 'super_admin';
export const isProjectManagerOrAbove = (role) => hasMinRole(role, 'project_manager');
