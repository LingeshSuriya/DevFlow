# DevFlow — local setup

Scope: Auth (email/password + GitHub OAuth), Dashboard, Board, Chat. Real-time via
Socket.io. Roles per org member: Owner, Admin, Developer, Tester, Pentester, Viewer.

## 1. Database
```
docker compose up -d
```
Postgres on `localhost:5432` (user/pass/db: `devflow`).

## 2. Backend
```
cd server
npm install
cp .env.example .env
```
Edit `.env`:
- `JWT_SECRET` — any long random string.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — only needed for the "Continue with GitHub"
  button. Create an OAuth App at https://github.com/settings/developers with:
  - Homepage URL: `http://localhost:5173`
  - Authorization callback URL: `http://localhost:5000/api/auth/github/callback`
  Email/password login works fine without these.

```
npm run prisma:migrate   # creates tables
npm run prisma:seed      # 3 sample users with different roles, tasks, channel messages
npm run dev               # http://localhost:5000
```

Seeded logins (password is `password123` for all):
| Email | Role |
|---|---|
| arjun@devflow.dev | Owner |
| rhea@devflow.dev | Tester |
| priya@devflow.dev | Pentester |

## 3. Frontend
```
npm install
npm run dev                # http://localhost:5173
```
Go to `/login` (or `/register` to create your own account — new signups get `Developer`).

## What's wired up
- **Auth**: register/login with JWT, GitHub OAuth, `/auth/me` restores session on refresh.
  Token stored in `localStorage`, attached to every API call and to the Socket.io handshake.
- **Roles**: every org member has one of Owner/Admin/Developer/Tester/Pentester/Viewer.
  Shown as a badge in the sidebar and on each task card.
- **Board**: click any task to open its detail modal — reassign it (dropdown shows each
  person's role), change status, edit description. Real-time sync over Socket.io.
- **Chat**: sender is derived from your JWT, not user-selectable. Real-time per channel.
- **Dashboard**: "Open tasks" is live. PR/bug counts and the activity feed are static
  placeholders — those need the Bug Tracker / Code Review modules (not built yet).

## Troubleshooting "Failed to fetch"
This means the browser couldn't reach `http://localhost:5000` at all — it's a network
error, not a login/permissions error. Check in order:
1. Is Postgres running? `docker ps` should show a `postgres` container.
2. Is the backend running? You should see `DevFlow API listening on :5000` in that terminal.
3. Did migrate + seed actually run without errors? Re-run `npm run prisma:migrate` and
   `npm run prisma:seed` inside `server/` and read the output.
4. Open `http://localhost:5000/api/health` directly in a browser — it should return `{"ok":true}`.
   If it doesn't load, the backend isn't reachable and nothing above it will work either.

## Known simplifications (next increments)
- Single hardcoded org (`devflow-team`) — no multi-org switching or invite flow yet.
- No role-based UI restrictions yet (e.g. Viewer can still edit tasks) — roles are tracked
  and displayed but not enforced on the backend.
- No chat message pagination.
- CORS is wide open (`origin: "*"`) — fine for local dev, not for prod.
