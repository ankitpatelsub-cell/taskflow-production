# TaskFlow — Professional Project Management App

A full-stack project management tool built for professional teams.

## Tech Stack
- **Frontend:** React 18 + Vite + TanStack Router + TanStack Query + Zustand + Tailwind CSS + Radix UI + @dnd-kit
- **Backend:** Node.js + Express 4 + SQLite (better-sqlite3)
- **Auth:** JWT access tokens + HttpOnly refresh cookies
- **Backup:** AES-256-CBC encrypted scheduled backups (node-cron)

## Features
- 🔐 Admin / User role-based access control
- 📁 Project-wise task management
- 🗂️ Kanban board (drag-and-drop) + List view
- ✅ Tasks with title, deadline, assignee, priority, subtasks, comments, attachments
- 🏷️ Color-coded tags per project
- 📅 Daily Standup view (user-wise, overdue highlighted, copy to clipboard)
- 🔔 In-app notifications
- 💾 Encrypted scheduled backups + admin restore UI
- 👥 User management (admin panel)

## Quick Start

### 1. Backend
```bash
cd backend
# Edit .env (copy from .env.example and change secrets)
npm install
node index.js
```
> Default admin: `admin@taskflow.local` / `admin123`

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`

### Windows — double-click shortcuts
- `start-backend.bat`
- `start-frontend.bat`

## Running Tests
```bash
# Backend (33 tests)
cd backend && npm test

# Frontend (53 tests)
cd frontend && npm test
```

## Environment Variables (backend/.env)
| Variable | Description |
|---|---|
| `JWT_SECRET` | Access token signing key (change in production!) |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `BACKUP_ENCRYPTION_KEY` | AES-256 key for backup encryption |
| `BACKUP_CRON` | Cron schedule for auto-backup (default: `0 2 * * *`) |
| `BACKUP_RETENTION_DAYS` | Number of backup files to keep (default: 30) |
| `PORT` | Backend port (default: 3001) |
| `CORS_ORIGIN` | Frontend URL for CORS |
