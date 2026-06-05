const { verifyAccess } = require('../utils/jwt');
const { queryOne } = require('../config/db');
const logger = require('../config/logger');

const ROLE_WEIGHTS = {
  super_admin:     5,
  admin:           4,
  project_manager: 3,
  member:          2,
  viewer:          1,
};

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
    logger.warn({ method: req.method, url: req.url, ip: req.ip }, 'auth.token_invalid');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!hasMinRole(req.user.role, role)) {
      logger.warn({ userId: req.user.id, userRole: req.user.role, required: role, url: req.url }, 'auth.forbidden');
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!hasMinRole(req.user.role, minRole)) {
      logger.warn({ userId: req.user.id, userRole: req.user.role, required: minRole, url: req.url }, 'auth.forbidden');
      return res.status(403).json({ error: `Requires ${minRole} or above` });
    }
    next();
  };
}

function requireProjectAccess(req, res, next) {
  if (hasMinRole(req.user.role, 'admin')) return next();
  const projectId = req.params.projectId || req.params.pid;
  queryOne(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, req.user.id]
  ).then((member) => {
    if (!member) {
      logger.warn({ userId: req.user.id, projectId, url: req.url }, 'auth.not_project_member');
      return res.status(403).json({ error: 'Not a project member' });
    }
    next();
  }).catch(next);
}

function requireProjectManage(req, res, next) {
  if (hasMinRole(req.user.role, 'admin')) return next();
  const projectId = req.params.projectId || req.params.pid;
  if (req.user.role === 'project_manager') {
    queryOne(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, req.user.id]
    ).then((member) => {
      if (member) return next();
      logger.warn({ userId: req.user.id, projectId, url: req.url }, 'auth.not_project_manager');
      return res.status(403).json({ error: 'Project manager or admin required' });
    }).catch(next);
  } else {
    logger.warn({ userId: req.user.id, userRole: req.user.role, projectId, url: req.url }, 'auth.forbidden');
    res.status(403).json({ error: 'Project manager or admin required' });
  }
}

function requireWriteAccess(req, res, next) {
  if (req.user.role === 'viewer') {
    logger.warn({ userId: req.user.id, url: req.url }, 'auth.viewer_write_denied');
    return res.status(403).json({ error: 'Viewers have read-only access' });
  }
  next();
}

module.exports = {
  authenticate, requireRole, requireMinRole,
  requireProjectAccess, requireProjectManage, requireWriteAccess,
  hasMinRole, ROLE_WEIGHTS,
};
