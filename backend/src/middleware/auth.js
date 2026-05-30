const { verifyAccess } = require('../utils/jwt');
const { getDb } = require('../config/db');

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

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireProjectAccess(req, res, next) {
  if (req.user.role === 'admin') return next();
  const db = getDb();
  const projectId = req.params.projectId || req.params.pid;
  const member = db
    .prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: 'Not a project member' });
  }
  next();
}

module.exports = { authenticate, requireRole, requireProjectAccess };
