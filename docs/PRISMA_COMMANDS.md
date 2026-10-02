# Prisma commands in this project — what each one does, and when to use it

Run everything below from `server/`.

---

## The mental model

Prisma tracks your database schema as a series of **migration files** — plain SQL,
stored in `server/prisma/migrations/`, one timestamped folder per change. Postgres itself
keeps a table called `_prisma_migrations` that records which of those files have already
been applied. Two things read `schema.prisma`:

- **Migration commands** (`migrate dev`, `migrate reset`) — turn schema changes into SQL
  files and apply them. They touch the *structure* of the database (tables, columns).
- **The seed script** (`prisma/seed.js`) — a plain Node script that uses Prisma Client to
  `INSERT` rows. It touches the *data*, not the structure, and has no idea what a
  migration is.

Keeping those two concerns separate is why "reset" and "seed" are different commands.

---

## `npm run prisma:migrate`
**Runs:** `prisma migrate dev --name init`

**What it does:** Compares `schema.prisma` against the migration history. If you changed
the schema (added a model, added a column, etc.) and there's no migration file for that
change yet, it generates one — a new timestamped folder with the SQL needed to get the
database from "before" to "after" — then immediately applies it to your dev database and
regenerates Prisma Client (the typed JS API you `import { PrismaClient }` from).

**What triggers it:** You, manually, after editing `schema.prisma`. Prisma doesn't watch
the file — nothing happens until you run this.

**Data safety:** Usually preserves existing data. If a change is destructive (e.g.
dropping a column that has data in it), Prisma will warn you before applying it.

**When to use it:** Day-to-day schema changes. You add a field to `schema.prisma`, run
this, and your dev database catches up — without touching rows you already have.

**The `--name init` quirk:** this script hardcodes the migration's name to `init`, which
only makes sense for the very *first* migration. If you add a new model later and run
`npm run prisma:migrate` again, it'll create a second migration also folder-named
`..._init`, which is confusing to read back later. For anything after the first migration,
run `npx prisma migrate dev --name add_something_descriptive` directly instead of the
npm script.

---

## `npm run prisma:seed`
**Runs:** `node prisma/seed.js`

**What it does:** Executes the seed script directly — nothing Prisma-CLI-specific about
it, it's just a Node file that happens to use Prisma Client. It `create()`s the demo
users, orgs, tasks, bugs, reviews, and pipeline runs that this project ships with.

**What triggers it:** You, manually — or `prisma migrate reset`, automatically, *if*
`package.json` has a `"prisma": { "seed": "node prisma/seed.js" }` block telling the CLI
what your seed command is. (Earlier versions of this project were missing that block —
see the incident below.)

**Data safety: NOT idempotent.** Every line in `seed.js` is `.create()`, not `.upsert()`.
Run it twice against a database that already has those rows, and you'll hit a unique
constraint error on the first duplicate `email` — which is exactly the error you hit
originally, before the `migrate reset` issue.

**When to use it:** Only on an empty (or freshly reset) database. Never run it a second
time without wiping first.

---

## `npx prisma migrate reset`
**What it does:** The nuclear option. Drops the entire database, recreates it from
scratch by replaying every migration file in order, then — if the seed config exists in
`package.json` — prompts "Do you want to seed?" and runs it for you.

**What triggers it:** Only you, running it directly. Nothing in this app calls it.

**Data safety: fully destructive.** Every row in every table is gone. This is the whole
point of the command — it gets you back to a known-clean state.

**When to use it:**
- Your dev database is in a weird state you don't want to debug (half-applied migration,
  manually-edited rows, etc.) and you'd rather start over.
- You pulled a version of this project with schema changes and don't care about keeping
  old data.
- You hit the "unique constraint failed" seed error and just want a clean slate — reset,
  then seed runs automatically (once the `package.json` fix below is in place).

---

## `npx prisma migrate dev` (no `--name`)
**What it does:** Same engine as `npm run prisma:migrate` above, but without a hardcoded
migration name — Prisma will ask you to type one interactively if it detects pending
schema changes. If there's nothing new in `schema.prisma`, it just applies any migration
files that exist on disk but haven't been recorded in `_prisma_migrations` yet (useful
after pulling someone else's migration folder from git).

**When to use it:** Prefer this over the `npm run prisma:migrate` script for every schema
change *after* the first one, so each migration folder gets a name that describes what it
actually did.

---

## The incident: why login broke after `migrate reset`

What happened, in order:
1. You ran `npx prisma migrate reset`.
2. This project's `server/package.json` had no `"prisma": { "seed": ... }` block.
3. Without that block, the Prisma CLI doesn't know a seed command exists — it resets the
   schema and **silently skips seeding**. No prompt, no error, no users.
4. You tried to log in as `arjun@devflow.dev` — an account that no longer existed —
   and got "Invalid email or password".

**The fix** (already applied in the latest zip): added
```json
"prisma": { "seed": "node prisma/seed.js" }
```
to `server/package.json`. Now `migrate reset` knows what to run and will prompt you to
seed automatically.

**Immediate fix, without re-downloading:** just run `npm run prisma:seed` once against
your current (now-empty) database.

---

## Quick reference

| Command | Changes structure? | Changes data? | Destructive? | Idempotent? |
|---|---|---|---|---|
| `prisma migrate dev` | Yes (new changes) | No | No (usually) | Yes — reapplying is a no-op |
| `prisma migrate reset` | Yes (full rebuild) | Yes (wipes, then reseeds if configured) | **Yes, fully** | Yes — always ends in the same state |
| `node prisma/seed.js` | No | Yes (inserts) | No | **No — fails on 2nd run** |

**Golden rule:** never run the seed script twice in a row without a `migrate reset` (or
manually clearing the tables) in between.
