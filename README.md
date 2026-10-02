# DevFlow

Multi-tenant dev-team workspace: Kanban board, bug tracker, code review, chat, live activity
feed. Postgres + Prisma, Express + Socket.io, React + Vite + Tailwind.

## Setup
```
docker compose up -d                 # Postgres on localhost:5433

cd server
npm install
cp .env.example .env                 # set JWT_SECRET; GitHub vars optional
npx prisma migrate reset             # applies schema + runs the seed (say yes)
npm run dev                          # API on :5000

cd ..                                # new terminal
npm install
npm run dev                          # app on :5173
```

**Upgrading an existing checkout:** the schema gained tables (bugs, reviews, activity log)
since older versions. From `server/`, run `npx prisma migrate reset` (wipes data, reapplies,
reseeds) or `npx prisma migrate dev` (keeps data, but you won't get the new seed users).
Never run `npm run prisma:seed` twice without a reset in between — it inserts, never upserts.

## Seeded logins (password `password123`)
| Email | Core Platform | Side Project |
|---|---|---|
| arjun@devflow.dev | Owner | Developer |
| rhea@devflow.dev | Tester | — |
| priya@devflow.dev | Pentester | — |
| karan@devflow.dev | Developer | — |

## Authorization — two layers, both enforced on the server

**Layer 1 — role ("is this *kind* of action allowed for you?").**
`server/src/lib/permissions.js` + `requirePermission()` middleware.

| Permission | Who |
|---|---|
| `CREATE_TASKS` | Owner, Admin, Developer |
| `BUG_WRITE` (report / update / comment) | Owner, Admin, Developer, Tester, Pentester |
| `IMPORT_REVIEW`, `DECIDE_REVIEW` | Owner, Admin, Developer |
| `COMMENT_REVIEW`, `SEND_CHAT` | Owner, Admin, Developer, Tester, Pentester |
| `INVITE_MEMBERS` | Owner, Admin |
| `MANAGE_MEMBERS` (change roles / remove) | Owner |
| `PIPELINE_TRIGGER` (simulate a run) | Owner, Admin, Developer |
| `PIPELINE_ROLLBACK` | Owner, Admin |
| `MANAGE_ORG_SETTINGS` (connect a repo) | Owner |

**Layer 2 — resource ("is *this change to this specific task* allowed for you?").**
`server/src/lib/taskAccess.js`, called from `PATCH /api/tasks/:id`. A role alone isn't enough:
a Developer has `CREATE_TASKS`, but that doesn't let them touch a teammate's card.

| Role | What they may do to a task |
|---|---|
| Owner / Admin | Anything, on any task, including reassigning |
| Developer | Edit and move **only tasks assigned to them**. May *claim* an unassigned task or *release* their own. Cannot take a task from someone else or hand theirs to someone else |
| Tester / Pentester | QA gate only: a task **in Review** can be passed (→ Done) or sent back (→ In Progress). No editing, no reassigning, nothing outside Review |
| Viewer | Read-only |

The frontend mirrors both layers (`src/data/permissions.js`, `src/data/taskAccess.js`) purely
to decide which buttons to show. If the two ever disagree, the server wins with a `403`.
`node` tests for the task rules: 19 cases across every role (see the test list in the changelog
of the conversation, or re-create from `taskAccess.js`).

## Org & member management
- Every signup creates its own org and becomes its Owner; users can belong to many orgs with a
  different role in each. Every org-scoped request carries `X-Org-Id`, re-verified against the
  DB by `requireOrg` on every call.
- Owners can change roles and remove members from **Organization**. An org always keeps at
  least one Owner. Removing a member unassigns their tasks/bugs and drops their live socket
  connections. Role changes and removals update every open session live.
- Admins can invite existing users, but only as Developer/Tester/Pentester/Viewer — only an
  Owner can grant Admin.
- Invite-by-email only works for people who already have an account.

## Modules
- **Board** — "New task" form takes title, description, assignee, points and starting column
  in one step. Click a card for details; each control is enabled only if the rules above allow it.
- **Bugs**, **Reviews** (public GitHub PRs via `<pr-url>.diff`, inline comments, decisions),
  **Chat**, **Dashboard** (live counts + activity feed).
- **Pipelines** (Module 7, trimmed) — see below.

### CI/CD Pipeline Monitor — what's real vs. trimmed
We don't execute CI ourselves — that's what GitHub Actions already does, and building a
second one would be its own product. Two ways runs get into the system:
- **Real**: connect a repo (`owner/repo`) as Owner on the Organization page, then point a
  GitHub webhook at `POST /api/webhooks/github` for `workflow_run` events. Verified with
  HMAC (`GITHUB_WEBHOOK_SECRET`) if set. This needs your server reachable from the internet
  (e.g. `ngrok http 5000`) — GitHub can't call `localhost`.
- **Simulated**: the "Simulate run" / "Simulate failure" buttons on `/pipelines` fabricate a
  run with steps and complete it instantly, no real infra involved — this is how the module
  is demoable without exposing your machine. `Owner/Admin/Developer` can trigger; rollback
  (also simulated — nothing is actually deployed) is `Owner/Admin` only.
- Not built: real step-by-step logs for webhook-driven runs (needs the GitHub Actions API +
  a repo token — webhook-driven runs only carry overall status), Slack/email failure alerts.

## Known leftovers (not built)
AI features (task/bug/review assist), live cursor presence in code review, bug file
attachments, pagination anywhere (chat/bugs/reviews/pipelines all load their most recent
batch with no "load more"), a wiki module, real step logs for webhook CI runs, Slack/email
alerting.

## GitHub OAuth (optional)
OAuth App at https://github.com/settings/developers — homepage `http://localhost:5173`,
callback `http://localhost:5000/api/auth/github/callback`; put the ID/secret in `server/.env`.
This is separate from the CI/CD webhook above — one logs people in, the other reports build
status; neither depends on the other.

## Troubleshooting "Failed to fetch"
The browser can't reach `localhost:5000`: is Postgres up (`docker ps`), is the API running,
did migrate/seed finish, does `http://localhost:5000/api/health` return `{"ok":true}`?

## Git
Extract new versions *into* the existing repo folder (overwrite in place) so `.git` survives,
then `git add -A && git commit`.
