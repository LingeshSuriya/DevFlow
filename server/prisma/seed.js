import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Users (not yet tied to any org) ---
  const arjun = await prisma.user.create({
    data: { email: "arjun@devflow.dev", passwordHash, name: "Arjun K", initials: "AK", color: "bg-emerald-500" },
  });
  const rhea = await prisma.user.create({
    data: { email: "rhea@devflow.dev", passwordHash, name: "Rhea S", initials: "RS", color: "bg-sky-500" },
  });
  const priya = await prisma.user.create({
    data: { email: "priya@devflow.dev", passwordHash, name: "Priya N", initials: "PN", color: "bg-violet-500" },
  });

  // --- Org 1: core-platform. Arjun owns it, Rhea tests, Priya pentests. ---
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
  await prisma.channel.createMany({
    data: [{ name: "general", orgId: coreOrg.id }, { name: "bugs", orgId: coreOrg.id }],
  });

  await prisma.task.createMany({
    data: [
      { orgId: coreOrg.id, title: "Fix JWT refresh race condition", status: "todo", points: 3, assigneeId: arjun.id, description: "Refresh token can be reused if two requests race after expiry." },
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

  // --- Org 2: side-project. Arjun is just a Developer here — proves same user, different role, different data. ---
  const sideOrg = await prisma.organization.create({
    data: {
      name: "Side Project",
      slug: "side-project",
      members: { create: [{ userId: arjun.id, role: "DEVELOPER" }] },
    },
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

  console.log("Seeded 2 orgs. Login with any of:");
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
