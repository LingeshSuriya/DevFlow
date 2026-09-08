# DevFlow — local setup

Scope: multi-tenant Auth + RBAC, Dashboard, Board, Bug Tracker, Code Review, Chat.
Real-time via Socket.io.

## 1. Database
```
docker compose up -d
```
Postgres on `localhost:5433` → `5432` inside the container. `user/pass/db`: `devflow`.

## 2. Backend
```
cd server
npm install
cp .env.example .env      # fill in JWT_SECRET; GitHub vars optional
npm run prisma:migrate
npm run prisma:seed
npm run dev                 # http://localhost:5000
```

## 3. Frontend
```
npm install
npm run dev                 # http://localhost:5173
```

## Module 4 — Bug Tracker
- `/bugs`: filter by severity/status, report a bug, real-time list updates.
- `/bugs/:id`: description, steps to reproduce, comments, and inline editing of
  severity/status/assignee. Can be linked to a `Task` (seed data shows this — the JWT
  refresh bug links to the JWT refresh task).
- Not implemented from the original spec: screenshot/file attachments, AI duplicate
  detection, email notifications, bug analytics (fix-time/recurrence charts).

## Module 3 — Code Review (trimmed scope)
What's real:
- Import any **public** GitHub PR by URL — the backend fetches `<pr-url>.diff` directly
  from GitHub (no token needed for public repos) and stores the raw unified diff.
- A parsed, colorized diff viewer (additions/deletions/context) — hand-written, not a
  third-party diff library.
- Click any line in the diff to leave an inline comment, broadcast in real time to
  everyone viewing that PR (`review:<id>` Socket.io room).
- Review decisions: Approve / Request changes / Mark merged, each posts a comment and
  updates status for everyone watching live.

What's intentionally **not** built (flagged in the original scoping conversation as too
heavy for this project):
- AI-powered review (bug/security/performance detection) — needs an LLM API integration,
  a separate module.
- Live cursor presence (seeing where teammates are looking) — a real-time systems problem
  on its own.
- Breaking-change / AST diffing — static analysis tooling, out of scope.
- Private repos — would need a GitHub token + auth flow per-repo, not implemented.

## Multi-tenancy
Every signup (email/password or GitHub) creates its own new organization and becomes its
Owner. A user can belong to multiple orgs with different roles in each — switch via the
sidebar dropdown. Every org-scoped request carries an `X-Org-Id` header, re-verified
server-side against real DB membership on every call (`requireOrg` middleware) — the
frontend's claim is never trusted blindly.

## Roles
`Owner / Admin / Developer / Tester / Pentester / Viewer`, per-org via `OrgMember.role`.
Shown as badges throughout. Owner/Admin can invite existing users into their org from
`/org`. **Not yet enforced** — e.g. a Viewer can still edit tasks/bugs. Natural next step.

## Seeded logins (password `password123` for all)
| Email | Core Platform | Side Project |
|---|---|---|
| arjun@devflow.dev | Owner | Developer |
| rhea@devflow.dev | Tester | — |
| priya@devflow.dev | Pentester | — |

Core Platform is seeded with tasks, a demo bug (linked to a task, with a comment), and a
demo code review (with a diff and a comment) so everything is browsable immediately
without needing network access or a real GitHub PR.

## GitHub OAuth (optional, for login)
Create an OAuth App at https://github.com/settings/developers:
- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:5000/api/auth/github/callback`

Paste Client ID/Secret into `server/.env`, restart the backend. Email/password login
works with zero GitHub config. (This is separate from importing PRs for code review,
which needs no auth at all for public repos.)

## Troubleshooting "Failed to fetch"
Means the browser couldn't reach `http://localhost:5000` — a network error, not
login/permissions.
1. `docker ps` — postgres container up?
2. Backend terminal showing `DevFlow API listening on :5000`?
3. Did `prisma migrate` / `prisma seed` finish without errors?
4. Open `http://localhost:5000/api/health` directly — should return `{"ok":true}`.

## Working with git
Don't delete the project folder between updates — extract new files **into** the existing
repo folder (overwrite in place), then `git add -A && git commit`.

## Known simplifications
- Role permissions tracked but not enforced on the backend.
- Bug attachments, PR AI review, live cursors — not built (see above).
- Invite-by-email only works for people who already have an account.
- No pagination anywhere yet.
- CORS wide open (`origin: "*"`) — fine for local dev, not prod.
