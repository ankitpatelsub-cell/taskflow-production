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
  role:     z.enum(['admin', 'user']).optional().default('user'),
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
const createTaskSchema = z.object({
  title:           z.string().min(1, 'Title required').max(200),
  description:     z.string().max(2000).optional().nullable(),
  status:          z.enum(['todo', 'in_progress', 'review', 'done']).optional().default('todo'),
  priority:        z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  assignee_id:     z.string().uuid().optional().nullable(),
  deadline:        z.string().optional().nullable(),
  estimated_hours: z.number().positive().optional().nullable(),
  parent_task_id:  z.string().uuid().optional().nullable(),
  tag_ids:         z.array(z.string().uuid()).optional(),
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
