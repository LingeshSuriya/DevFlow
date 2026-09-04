# DevFlow — local setup

Scope: multi-tenant Auth + RBAC, Dashboard, Board, Chat. Real-time via Socket.io.

## 1. Database
```
docker compose up -d
```
Postgres on `localhost:5433` → `5432` inside the container (host port changed to avoid
clashing with a local Postgres install). `user/pass/db`: `devflow`.

## 2. Backend
```
cd server
npm install
cp .env.example .env      # fill in JWT_SECRET; GitHub vars optional
npm run prisma:migrate     # this is a NEW schema — if you have an old DB, this will
                            # prompt to reset it since Task/Channel gained required orgId columns
npm run prisma:seed
npm run dev                 # http://localhost:5000
```

## 3. Frontend
```
npm install
npm run dev                 # http://localhost:5173
```

## Multi-tenancy — how it actually works now
- Every signup (email/password or GitHub) creates its own **new organization** and the
  signer becomes its **Owner**. Nobody lands in a shared default org anymore.
- A user can belong to **multiple orgs** with a **different role in each** — `OrgMember`
  is a join table (`userId`, `orgId`, `role`). The seed data demonstrates this: Arjun is
  Owner of "Core Platform" and separately a Developer in "Side Project".
- Every request that touches org-scoped data (`Task`, `Channel`, `User` list) must send an
  `X-Org-Id` header. The frontend does this automatically via `OrgContext` — whichever org
  is selected in the sidebar switcher is the one every API call and Socket.io room uses.
- The backend never trusts the frontend's claim of membership — `requireOrg` middleware
  re-checks `req.user.memberships` (loaded from the DB on every request) before allowing
  any org-scoped query through.
- Switch orgs from the dropdown at the top of the sidebar. Board/Chat/Dashboard reload for
  the newly selected org; there's no cross-org bleed — a task in Org A is never returned
  when `X-Org-Id` is Org B, enforced at the query level (`where: { orgId: req.orgId }`).

## Roles
`Owner / Admin / Developer / Tester / Pentester / Viewer`, tracked per-org via `OrgMember.role`.
- Shown as a badge in the sidebar (for the active org) and on task cards / the org page.
- **Owner/Admin** can invite existing users into their org from `/org` (Organization page in
  the sidebar). Invitee must already have a DevFlow account (any org) — this MVP doesn't
  send email invites to brand-new addresses yet.
- Roles are tracked and displayed but **not yet enforced** — e.g. a Viewer can currently
  still edit tasks. That's the natural next increment.

## Seeded logins (password `password123` for all)
| Email | Core Platform | Side Project |
|---|---|---|
| arjun@devflow.dev | Owner | Developer |
| rhea@devflow.dev | Tester | — |
| priya@devflow.dev | Pentester | — |

Log in as Arjun and use the org switcher to see the same account behave completely
differently (different role, different tasks, different chat) depending on which org
is active.

## GitHub OAuth (optional)
Create an OAuth App at https://github.com/settings/developers:
- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:5000/api/auth/github/callback`

Paste the Client ID/Secret into `server/.env`, restart the backend. Email/password login
works with zero GitHub config.

## Troubleshooting "Failed to fetch"
Means the browser couldn't reach `http://localhost:5000` at all — a network error, not a
login/permissions one.
1. `docker ps` — is the postgres container up?
2. Is the backend terminal showing `DevFlow API listening on :5000`?
3. Did `prisma migrate` / `prisma seed` finish without errors?
4. Open `http://localhost:5000/api/health` directly — should return `{"ok":true}`.

## Working with git
Don't delete the project folder between updates — extract new files **into** the existing
repo folder (overwrite in place), then `git add -A && git commit`. Deleting and
re-extracting wipes `.git` and forces you into `git init` + a force-push every time.

## Known simplifications (next increments)
- Role permissions aren't enforced on the backend yet (tracked but not gated).
- Invite-by-email only works for people who already have an account.
- No chat message pagination.
- CORS is wide open (`origin: "*"`) — fine for local dev, not for prod.
