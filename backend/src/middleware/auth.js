const crypto = require('crypto');
const { verifyAccess } = require('../utils/jwt');
const { queryOne, execute } = require('../config/db');
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
  const token = header.slice(7);

  // API key authentication for tick_ prefixed tokens
  if (token.startsWith('tick_')) {
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    queryOne(
      `SELECT k.id, k.scopes, k.user_id, k.expires_at,
              u.id as uid, u.name, u.email, u.role
       FROM api_keys k JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = ?`,
      [keyHash]
    ).then(async (row) => {
      if (!row) {
        logger.warn({ ip: req.ip }, 'auth.api_key_invalid');
        return res.status(401).json({ error: 'Invalid API key' });
      }
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return res.status(401).json({ error: 'API key has expired' });
      }
      // Update last_used_at without awaiting (fire-and-forget)
      execute('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [row.id]).catch(() => {});
      req.user = { id: row.uid, name: row.name, email: row.email, role: row.role, api_key_scopes: row.scopes };
      req.apiKeyId = row.id;
      next();
    }).catch((err) => {
      logger.error(err, 'auth.api_key_lookup_error');
      res.status(500).json({ error: 'Authentication error' });
    });
    return;
  }

  try {
    const payload = verifyAccess(token);
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
