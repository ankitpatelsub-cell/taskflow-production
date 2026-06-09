-- Project templates
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  position INTEGER NOT NULL DEFAULT 0,
  parent_position INTEGER,
  estimated_hours NUMERIC(6,2),
  offset_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budget tracking
DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN budget_limit NUMERIC(12,2);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN hourly_rate NUMERIC(8,2);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD COLUMN budget_currency TEXT NOT NULL DEFAULT 'USD';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Seed 5 built-in templates
INSERT INTO project_templates (id, name, description, category, color, is_builtin) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Software Sprint', 'A standard 2-week agile sprint with planning, development, review, and retrospective tasks.', 'engineering', '#6366f1', true),
  ('00000000-0000-0000-0000-000000000002', 'Marketing Campaign', 'End-to-end campaign: brief, creative, launch, and reporting phases.', 'marketing', '#ec4899', true),
  ('00000000-0000-0000-0000-000000000003', 'Bug Tracker', 'Lightweight project for triaging and resolving bugs with priority lanes.', 'engineering', '#ef4444', true),
  ('00000000-0000-0000-0000-000000000004', 'Product Launch', 'Full product launch checklist from pre-launch through post-launch review.', 'product', '#f59e0b', true),
  ('00000000-0000-0000-0000-000000000005', 'Onboarding', 'New team member onboarding with setup tasks, introductions, and first-week milestones.', 'hr', '#10b981', true)
ON CONFLICT (id) DO NOTHING;

-- Template tasks for Software Sprint
INSERT INTO template_tasks (template_id, title, description, priority, position, estimated_hours) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Sprint Planning', 'Define sprint goal, review backlog, and commit to sprint scope.', 'high', 0, 2),
  ('00000000-0000-0000-0000-000000000001', 'Design review', 'Review mockups and finalize designs before development begins.', 'medium', 1, 1),
  ('00000000-0000-0000-0000-000000000001', 'Backend API development', 'Implement required API endpoints.', 'high', 2, 8),
  ('00000000-0000-0000-0000-000000000001', 'Frontend implementation', 'Build UI components and connect to API.', 'high', 3, 8),
  ('00000000-0000-0000-0000-000000000001', 'Write unit tests', 'Achieve >80% test coverage for new features.', 'medium', 4, 3),
  ('00000000-0000-0000-0000-000000000001', 'QA testing', 'Test all acceptance criteria and edge cases.', 'high', 5, 3),
  ('00000000-0000-0000-0000-000000000001', 'Code review', 'Review all PRs and ensure code quality standards.', 'medium', 6, 2),
  ('00000000-0000-0000-0000-000000000001', 'Sprint review', 'Demo completed work to stakeholders.', 'medium', 7, 1),
  ('00000000-0000-0000-0000-000000000001', 'Retrospective', 'Identify what went well and areas for improvement.', 'low', 8, 1);

-- Template tasks for Marketing Campaign
INSERT INTO template_tasks (template_id, title, description, priority, position, estimated_hours) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Campaign brief', 'Define goals, target audience, messaging, and budget.', 'high', 0, 3),
  ('00000000-0000-0000-0000-000000000002', 'Competitor analysis', 'Review competitor campaigns for insights and differentiation.', 'medium', 1, 2),
  ('00000000-0000-0000-0000-000000000002', 'Creative development', 'Design assets: banners, social posts, email templates.', 'high', 2, 8),
  ('00000000-0000-0000-0000-000000000002', 'Copy writing', 'Write headlines, body copy, and CTAs.', 'high', 3, 4),
  ('00000000-0000-0000-0000-000000000002', 'Landing page setup', 'Create and test the campaign landing page.', 'high', 4, 4),
  ('00000000-0000-0000-0000-000000000002', 'Email sequence setup', 'Configure email automation and sequences.', 'medium', 5, 3),
  ('00000000-0000-0000-0000-000000000002', 'Social media scheduling', 'Schedule all social posts across channels.', 'medium', 6, 2),
  ('00000000-0000-0000-0000-000000000002', 'Campaign launch', 'Go live — activate all channels simultaneously.', 'high', 7, 1),
  ('00000000-0000-0000-0000-000000000002', 'Performance review', 'Analyze metrics: CTR, conversions, CAC, ROAS.', 'high', 8, 2);

-- Template tasks for Bug Tracker
INSERT INTO template_tasks (template_id, title, description, priority, position, estimated_hours) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Bug triage session', 'Review all open bugs, assign severity and priority.', 'high', 0, 1),
  ('00000000-0000-0000-0000-000000000003', 'Critical bug fix', 'Fix all P0 and P1 bugs blocking users.', 'urgent', 1, 4),
  ('00000000-0000-0000-0000-000000000003', 'Regression testing', 'Verify fixes don''t break existing functionality.', 'high', 2, 2),
  ('00000000-0000-0000-0000-000000000003', 'Medium priority bugs', 'Fix P2 bugs — impactful but not blocking.', 'medium', 3, 6),
  ('00000000-0000-0000-0000-000000000003', 'Update bug documentation', 'Document root causes and prevention steps.', 'low', 4, 1);

-- Template tasks for Product Launch
INSERT INTO template_tasks (template_id, title, description, priority, position, estimated_hours) VALUES
  ('00000000-0000-0000-0000-000000000004', 'Define launch scope and goals', 'Set KPIs, target metrics, and launch criteria.', 'high', 0, 2),
  ('00000000-0000-0000-0000-000000000004', 'Beta testing program', 'Recruit beta users, collect feedback, iterate.', 'high', 1, 10),
  ('00000000-0000-0000-0000-000000000004', 'Pricing and packaging finalization', 'Lock in pricing tiers, discounts, and trial terms.', 'high', 2, 3),
  ('00000000-0000-0000-0000-000000000004', 'Marketing materials', 'Website copy, press kit, demo video, screenshots.', 'high', 3, 8),
  ('00000000-0000-0000-0000-000000000004', 'Sales enablement', 'Sales deck, objection handling guide, competitive matrix.', 'medium', 4, 4),
  ('00000000-0000-0000-0000-000000000004', 'Launch day execution', 'Coordinate PH/HN post, email blast, social, PR.', 'high', 5, 3),
  ('00000000-0000-0000-0000-000000000004', 'Post-launch monitoring', 'Monitor signups, errors, support tickets for 48h.', 'high', 6, 4),
  ('00000000-0000-0000-0000-000000000004', 'Launch retrospective', 'Document lessons learned and celebrate wins.', 'low', 7, 1);

-- Template tasks for Onboarding
INSERT INTO template_tasks (template_id, title, description, priority, position, estimated_hours) VALUES
  ('00000000-0000-0000-0000-000000000005', 'Workspace setup', 'Set up laptop, accounts, and access permissions.', 'high', 0, 2),
  ('00000000-0000-0000-0000-000000000005', 'Team introductions', 'Meet with each team member for 15-min intro calls.', 'high', 1, 3),
  ('00000000-0000-0000-0000-000000000005', 'Read onboarding documentation', 'Review company handbook, processes, and tools guide.', 'medium', 2, 2),
  ('00000000-0000-0000-0000-000000000005', 'First project assignment', 'Get assigned to a starter task and complete it.', 'high', 3, 4),
  ('00000000-0000-0000-0000-000000000005', '30-day check-in', 'Sync with manager: blockers, feedback, and 90-day goals.', 'medium', 4, 1);
