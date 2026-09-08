import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SAMPLE_DIFF = `diff --git a/src/utils/formatDate.js b/src/utils/formatDate.js
index 8b13789..f9c1234 100644
--- a/src/utils/formatDate.js
+++ b/src/utils/formatDate.js
@@ -1,8 +1,9 @@
 export function formatDate(date) {
-  const d = new Date(date);
-  return d.toLocaleDateString();
+  const d = new Date(date);
+  if (Number.isNaN(d.getTime())) return "Invalid date";
+  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
 }
 
 export function formatTime(date) {
   const d = new Date(date);
   return d.toLocaleTimeString();
 }
diff --git a/src/utils/formatDate.test.js b/src/utils/formatDate.test.js
index e69de29..a1b2c3d 100644
--- a/src/utils/formatDate.test.js
+++ b/src/utils/formatDate.test.js
@@ -0,0 +1,7 @@
+import { formatDate } from "./formatDate";
+
+test("formats a valid date", () => {
+  expect(formatDate("2026-01-15")).toBe("Jan 15, 2026");
+});
+test("handles invalid input", () => {
+  expect(formatDate("not-a-date")).toBe("Invalid date");
+});
`;

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const arjun = await prisma.user.create({
    data: { email: "arjun@devflow.dev", passwordHash, name: "Arjun K", initials: "AK", color: "bg-emerald-500" },
  });
  const rhea = await prisma.user.create({
    data: { email: "rhea@devflow.dev", passwordHash, name: "Rhea S", initials: "RS", color: "bg-sky-500" },
  });
  const priya = await prisma.user.create({
    data: { email: "priya@devflow.dev", passwordHash, name: "Priya N", initials: "PN", color: "bg-violet-500" },
  });

  const coreOrg = await prisma.organization.create({
    data: {
      name: "Core Platform",
      slug: "core-platform",
      members: {
        create: [
          { userId: arjun.id, role: "OWNER" },
          { userId: rhea.id, role: "TESTER" },
          { userId: priya.id, role: "PENTESTER" },
        ],
      },
    },
  });

  const deployments = await prisma.channel.create({ data: { name: "deployments", orgId: coreOrg.id } });
  await prisma.channel.createMany({ data: [{ name: "general", orgId: coreOrg.id }, { name: "bugs", orgId: coreOrg.id }] });

  const jwtTask = await prisma.task.create({
    data: { orgId: coreOrg.id, title: "Fix JWT refresh race condition", status: "todo", points: 3, assigneeId: arjun.id, description: "Refresh token can be reused if two requests race after expiry." },
  });
  await prisma.task.createMany({
    data: [
      { orgId: coreOrg.id, title: "Add pagination to bug list", status: "todo", points: 2, assigneeId: rhea.id },
      { orgId: coreOrg.id, title: "Kanban drag-and-drop", status: "in_progress", points: 5, assigneeId: arjun.id },
      { orgId: coreOrg.id, title: "Diff viewer syntax highlight", status: "in_progress", points: 3, assigneeId: priya.id },
      { orgId: coreOrg.id, title: "Socket.io presence indicator", status: "review", points: 2, assigneeId: rhea.id },
      { orgId: coreOrg.id, title: "Org invite email flow", status: "done", points: 3, assigneeId: arjun.id },
    ],
  });

  await prisma.message.createMany({
    data: [
      { text: "pushed the diff viewer, can someone review?", channelId: deployments.id, userId: priya.id },
      { text: "on it, taking a look now", channelId: deployments.id, userId: arjun.id },
    ],
  });

  // --- Bugs ---
  const loginBug = await prisma.bug.create({
    data: {
      orgId: coreOrg.id,
      title: "Login redirect loops back to /login after GitHub OAuth",
      description: "Happens intermittently when the callback URL has a trailing slash mismatch.",
      stepsToReproduce: "1. Sign out\n2. Click 'Continue with GitHub'\n3. Approve on GitHub\n4. Lands back on /login instead of /dashboard",
      severity: "high",
      status: "in_progress",
      reporterId: rhea.id,
      assigneeId: arjun.id,
      linkedTaskId: jwtTask.id,
    },
  });
  await prisma.bugComment.create({
    data: { bugId: loginBug.id, userId: arjun.id, text: "Repro'd — it's the trailing slash on FRONTEND_URL. Fixing." },
  });

  await prisma.bug.createMany({
    data: [
      { orgId: coreOrg.id, title: "Kanban card overflow on long titles", description: "Text isn't truncated, breaks the column width.", severity: "low", status: "open", reporterId: priya.id },
      { orgId: coreOrg.id, title: "Socket disconnects silently on sleep/wake", description: "No reconnect indicator shown to the user.", severity: "medium", status: "open", reporterId: rhea.id, assigneeId: priya.id },
      { orgId: coreOrg.id, title: "SQL injection risk in raw search query", description: "Found during a security pass — needs parameterization.", severity: "critical", status: "fixed", reporterId: priya.id, assigneeId: arjun.id },
    ],
  });

  // --- Code review ---
  const review = await prisma.pullRequest.create({
    data: {
      orgId: coreOrg.id,
      title: "Handle invalid dates in formatDate()",
      sourceUrl: "https://github.com/example-org/devflow-demo/pull/42",
      diffText: SAMPLE_DIFF,
      status: "open",
      authorId: priya.id,
    },
  });
  await prisma.reviewComment.create({
    data: {
      prId: review.id,
      userId: arjun.id,
      fileName: "src/utils/formatDate.js",
      lineLabel: "+4",
      text: "Good catch on the NaN check — can you also add a JSDoc comment for the return type?",
    },
  });

  // --- Org 2: proves the same user gets a different role + different data elsewhere ---
  const sideOrg = await prisma.organization.create({
    data: { name: "Side Project", slug: "side-project", members: { create: [{ userId: arjun.id, role: "DEVELOPER" }] } },
  });
  const sideGeneral = await prisma.channel.create({ data: { name: "general", orgId: sideOrg.id } });
  await prisma.task.createMany({
    data: [
      { orgId: sideOrg.id, title: "Sketch landing page", status: "todo", points: 2, assigneeId: arjun.id },
      { orgId: sideOrg.id, title: "Pick a name that isn't taken", status: "in_progress", points: 1, assigneeId: arjun.id },
    ],
  });
  await prisma.message.create({
    data: { text: "started this org just to test multi-tenancy 👀", channelId: sideGeneral.id, userId: arjun.id },
  });

  console.log("Seeded 2 orgs, bugs, and a demo code review. Login with any of:");
  console.log("  arjun@devflow.dev / password123  (Owner of Core Platform, Developer in Side Project)");
  console.log("  rhea@devflow.dev  / password123  (Tester in Core Platform only)");
  console.log("  priya@devflow.dev / password123  (Pentester in Core Platform only)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
