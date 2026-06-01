const { z } = require('zod');

// ─── Auth ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

// ─── Users ───────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 chars'),
  email:    z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 chars'),
  role:     z.enum(['super_admin','admin','project_manager','member','viewer']).optional().default('member'),
  timezone: z.string().optional().default('UTC'),
});

const updateUserSchema = z.object({
  name:      z.string().min(2).optional(),
  avatar_url: z.string().url().optional().nullable(),
  timezone:  z.string().optional(),
  is_active: z.number().min(0).max(1).optional(),
}).strict();

// ─── Projects ────────────────────────────────────────────────────────────────
const createProjectSchema = z.object({
  name:        z.string().min(1, 'Name required').max(100),
  description: z.string().max(500).optional().nullable(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional().default('#6366f1'),
});

const updateProjectSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status:      z.enum(['active', 'archived']).optional(),
});

// ─── Tasks ───────────────────────────────────────────────────────────────────
const emptyToNull = (v) => (v === '' ? null : v);
const uuidOrEmpty = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());

const createTaskSchema = z.object({
  title:           z.string().min(1, 'Title required').max(200),
  description:     z.preprocess(emptyToNull, z.string().max(2000).optional().nullable()),
  status:          z.enum(['todo', 'in_progress', 'review', 'done']).optional().default('todo'),
  priority:        z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  assignee_id:     uuidOrEmpty,
  deadline:        z.preprocess(emptyToNull, z.string().optional().nullable()),
  estimated_hours: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().positive().optional().nullable()
  ),
  parent_task_id:   uuidOrEmpty,
  tag_ids:          z.array(z.string().uuid()).optional(),
  // ── Recurrence ──────────────────────────────────────────────────────────────
  recurrence_rule:     z.enum(['daily','weekly','monthly']).optional().nullable(),
  recurrence_interval: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? 1 : Number(v)),
    z.number().int().min(1).max(365).optional().default(1)
  ),
  recurrence_days:     z.string().optional().nullable(),   // JSON array e.g. "[1,3,5]"
  recurrence_ends_at:  z.preprocess(emptyToNull, z.string().optional().nullable()),
});

const updateTaskSchema = createTaskSchema.partial();

// ─── Comments ────────────────────────────────────────────────────────────────
const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
});

// ─── Tags ────────────────────────────────────────────────────────────────────
const createTagSchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#64748b'),
});

// ─── Validation middleware ────────────────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ error: errors.join('; '), details: result.error.errors });
    }
    req.body = result.data; // use coerced/defaulted values
    next();
  };
}

module.exports = {
  validate,
  loginSchema,
  createUserSchema, updateUserSchema,
  createProjectSchema, updateProjectSchema,
  createTaskSchema, updateTaskSchema,
  createCommentSchema,
  createTagSchema,
};
