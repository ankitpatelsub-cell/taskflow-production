-- Performance indexes for frequently queried columns
-- All use IF NOT EXISTS so this migration is safe to re-run

CREATE INDEX IF NOT EXISTS idx_tasks_created_by      ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id  ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id     ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id       ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_epic_id         ON tasks(epic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline        ON tasks(deadline);

CREATE INDEX IF NOT EXISTS idx_comments_user_id      ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id      ON comments(task_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_projects_created_by   ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects(status);

CREATE INDEX IF NOT EXISTS idx_time_logs_task_id     ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id     ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_logged_at   ON time_logs(logged_at);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity   ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id  ON activity_log(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user   ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token);

CREATE INDEX IF NOT EXISTS idx_webhooks_project_id   ON webhooks(project_id, active);
