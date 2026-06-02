const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, requireMinRole } = require('../middleware/auth');
const { createBackup, restoreBackup, listBackups } = require('../services/backupService');
const { upload } = require('../utils/fileUpload');

const router = express.Router();
router.use(authenticate, requireMinRole('super_admin'));

// GET /api/admin/backups
router.get('/backups', async (req, res) => {
  try {
    const backups = await listBackups();
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// POST /api/admin/backups
router.post('/backups', async (req, res) => {
  try {
    const result = await createBackup(req.user.id, req.body.notes || 'Manual backup');
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backups/restore
router.post('/backups/restore', upload.single('file'), async (req, res) => {
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
