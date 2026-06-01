const { verifyAccess } = require('../utils/jwt');
const { getDb } = require('../config/db');

// ── Role hierarchy ────────────────────────────────────────────────────────────
const ROLE_WEIGHTS = {
  super_admin:     5,
  admin:           4,
  project_manager: 3,
  member:          2,
  viewer:          1,
};

/** True if userRole meets or exceeds minRole in the hierarchy */
function hasMinRole(userRole, minRole) {
  return (ROLE_WEIGHTS[userRole] || 0) >= (ROLE_WEIGHTS[minRole] || 999);
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Require exact role (legacy) OR use requireMinRole instead */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role && !hasMinRole(req.user.role, role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/** Require user to have at least minRole in the hierarchy */
function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!hasMinRole(req.user.role, minRole)) {
      return res.status(403).json({ error: `Requires ${minRole} or above` });
    }
    next();
  };
}

/** Require user to be a project member (admin+ bypass) */
function requireProjectAccess(req, res, next) {
  if (hasMinRole(req.user.role, 'admin')) return next();
  const db = getDb();
  const projectId = req.params.projectId || req.params.pid;
  const member = db
    .prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a project member' });
  next();
}

/** Require project_manager or above — OR be a project member with pm+ role */
function requireProjectManage(req, res, next) {
  if (hasMinRole(req.user.role, 'admin')) return next();
  if (req.user.role === 'project_manager') {
    const db = getDb();
    const projectId = req.params.projectId || req.params.pid;
    const member = db
      .prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, req.user.id);
    if (member) return next();
  }
  return res.status(403).json({ error: 'Project manager or admin required' });
}

/** Viewers cannot write — block mutating operations */
function requireWriteAccess(req, res, next) {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Viewers have read-only access' });
  }
  next();
}

module.exports = {
  authenticate, requireRole, requireMinRole,
  requireProjectAccess, requireProjectManage, requireWriteAccess,
  hasMinRole, ROLE_WEIGHTS,
};
