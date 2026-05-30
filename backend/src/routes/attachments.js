const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../utils/fileUpload');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// POST /api/tasks/:taskId/attachments
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO attachments (id, task_id, user_id, filename, filepath, filesize) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.taskId, req.user.id, req.file.originalname, req.file.filename, req.file.size);
  res.status(201).json({ id, filename: req.file.originalname, filesize: req.file.size });
});

// GET /api/tasks/:taskId/attachments/:attachmentId
router.get('/:attachmentId', (req, res) => {
  const db = getDb();
  const att = db.prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?').get(req.params.attachmentId, req.params.taskId);
  if (!att) return res.status(404).json({ error: 'Not found' });
  const filepath = path.join(UPLOAD_DIR, att.filepath);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File missing' });
  res.download(filepath, att.filename);
});

// DELETE /api/tasks/:taskId/attachments/:attachmentId
router.delete('/:attachmentId', (req, res) => {
  const db = getDb();
  const att = db.prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?').get(req.params.attachmentId, req.params.taskId);
  if (!att) return res.status(404).json({ error: 'Not found' });
  const filepath = path.join(UPLOAD_DIR, att.filepath);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.attachmentId);
  res.json({ message: 'Deleted' });
});

module.exports = router;
