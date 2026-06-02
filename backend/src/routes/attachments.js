const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../utils/fileUpload');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// POST /api/tasks/:taskId/attachments
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id = uuidv4();
    await execute(
      'INSERT INTO attachments (id, task_id, user_id, filename, filepath, filesize) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.taskId, req.user.id, req.file.originalname, req.file.filename, req.file.size]
    );
    res.status(201).json({ id, filename: req.file.originalname, filesize: req.file.size });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/tasks/:taskId/attachments/:attachmentId
router.get('/:attachmentId', async (req, res) => {
  try {
    const att = await queryOne(
      'SELECT * FROM attachments WHERE id = ? AND task_id = ?',
      [req.params.attachmentId, req.params.taskId]
    );
    if (!att) return res.status(404).json({ error: 'Not found' });
    const filepath = path.join(UPLOAD_DIR, att.filepath);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File missing' });
    res.download(filepath, att.filename);
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// DELETE /api/tasks/:taskId/attachments/:attachmentId
router.delete('/:attachmentId', async (req, res) => {
  try {
    const att = await queryOne(
      'SELECT * FROM attachments WHERE id = ? AND task_id = ?',
      [req.params.attachmentId, req.params.taskId]
    );
    if (!att) return res.status(404).json({ error: 'Not found' });
    const filepath = path.join(UPLOAD_DIR, att.filepath);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    await execute('DELETE FROM attachments WHERE id = ?', [req.params.attachmentId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
