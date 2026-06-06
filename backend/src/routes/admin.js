const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, requireMinRole } = require('../middleware/auth');
const { createBackup, restoreBackup, listBackups } = require('../services/backupService');
const { upload } = require('../utils/fileUpload');
const { queryAll, queryOne } = require('../config/db');

const router = express.Router();
router.use(authenticate, requireMinRole('admin'));

// GET /api/admin/activity
router.get('/activity', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;
    const type = req.query.entity_type;
    const where = type ? 'WHERE al.entity_type = ?' : '';
    const params = type ? [type, limit, offset] : [limit, offset];
    const rows = await queryAll(`
      SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata,
             al.created_at, u.name AS user_name, u.avatar_url
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, params);
    const totalRow = await queryOne(`SELECT COUNT(*) as c FROM activity_log al ${where}`, type ? [type] : []);
    res.json({ rows, total: parseInt(totalRow.c, 10), page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// GET /api/admin/backups  (backups require super_admin)
router.get('/backups', requireMinRole('super_admin'), async (req, res) => {
  try {
    const backups = await listBackups();
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// POST /api/admin/backups  (backups require super_admin)
router.post('/backups', requireMinRole('super_admin'), async (req, res) => {
  try {
    const result = await createBackup(req.user.id, req.body.notes || 'Manual backup');
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backups/restore  (backups require super_admin)
router.post('/backups/restore', requireMinRole('super_admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });
  const uploadedPath = path.join(require('../utils/fileUpload').UPLOAD_DIR, req.file.filename);
  try {
    await restoreBackup(uploadedPath);
    fs.unlinkSync(uploadedPath);
    res.json({ message: 'Database restored successfully.' });
  } catch (err) {
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
