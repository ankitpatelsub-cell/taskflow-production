const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../utils/fileUpload');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Verify the task exists and the caller is a project member (or admin)
async function requireTaskAccess(req, res) {
  const task = await queryOne('SELECT project_id FROM tasks WHERE id = ?', [req.params.taskId]);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return null; }

  if (req.user.role === 'admin' || req.user.role === 'super_admin') return task;

  const member = await queryOne(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
    [task.project_id, req.user.id]
  );
  if (!member) { res.status(403).json({ error: 'Access denied' }); return null; }
  return task;
}

// POST /api/tasks/:taskId/attachments
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!await requireTaskAccess(req, res)) return;

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
    if (!await requireTaskAccess(req, res)) return;

    const att = await queryOne(
      'SELECT * FROM attachments WHERE id = ? AND task_id = ?',
      [req.params.attachmentId, req.params.taskId]
    );
    if (!att) return res.status(404).json({ error: 'Not found' });
    const filepath = path.join(UPLOAD_DIR, att.filepath);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File missing' });
    // Force download — prevents inline rendering of SVG/HTML that could contain scripts
    res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// DELETE /api/tasks/:taskId/attachments/:attachmentId
router.delete('/:attachmentId', async (req, res) => {
  try {
    if (!await requireTaskAccess(req, res)) return;

    const att = await queryOne(
      'SELECT * FROM attachments WHERE id = ? AND task_id = ?',
      [req.params.attachmentId, req.params.taskId]
    );
    if (!att) return res.status(404).json({ error: 'Not found' });

    // Only the uploader or a project manager/admin can delete
    const { hasMinRole } = require('../middleware/auth');
    if (att.user_id !== req.user.id && !hasMinRole(req.user.role, 'admin')) {
      const pm = await queryOne(
        'SELECT pm.role FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id WHERE t.id = ? AND pm.user_id = ?',
        [req.params.taskId, req.user.id]
      );
      if (!pm || pm.role === 'viewer') {
        return res.status(403).json({ error: 'Not authorized to delete this attachment' });
      }
    }

    const filepath = path.join(UPLOAD_DIR, att.filepath);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    await execute('DELETE FROM attachments WHERE id = ?', [req.params.attachmentId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
