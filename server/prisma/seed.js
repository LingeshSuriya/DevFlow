import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "devflow-team" },
    update: {},
    create: { name: "DevFlow Team", slug: "devflow-team" },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const seedUsers = [
    { email: "arjun@devflow.dev", name: "Arjun K", initials: "AK", color: "bg-emerald-500", role: "OWNER" },
    { email: "rhea@devflow.dev", name: "Rhea S", initials: "RS", color: "bg-sky-500", role: "TESTER" },
    { email: "priya@devflow.dev", name: "Priya N", initials: "PN", color: "bg-violet-500", role: "PENTESTER" },
  ];

  const users = {};
  for (const su of seedUsers) {
    const user = await prisma.user.create({
      data: {
        email: su.email,
        passwordHash,
        name: su.name,
        initials: su.initials,
        color: su.color,
        memberships: { create: { orgId: org.id, role: su.role } },
      },
    });
    users[su.initials] = user;
  }

  const { AK, RS, PN } = users;

  await prisma.task.createMany({
    data: [
      { title: "Fix JWT refresh race condition", status: "todo", points: 3, assigneeId: AK.id, description: "Refresh token can be reused if two requests race after expiry." },
      { title: "Add pagination to bug list", status: "todo", points: 2, assigneeId: RS.id, description: "" },
      { title: "Kanban drag-and-drop", status: "in_progress", points: 5, assigneeId: AK.id, description: "" },
      { title: "Diff viewer syntax highlight", status: "in_progress", points: 3, assigneeId: PN.id, description: "" },
      { title: "Socket.io presence indicator", status: "review", points: 2, assigneeId: RS.id, description: "" },
      { title: "Org invite email flow", status: "done", points: 3, assigneeId: AK.id, description: "" },
      { title: "Postgres schema for tasks", status: "done", points: 5, assigneeId: PN.id, description: "" },
    ],
  });

  const deployments = await prisma.channel.create({ data: { name: "deployments" } });
  await prisma.channel.createMany({ data: [{ name: "general" }, { name: "frontend" }, { name: "bugs" }] });

  await prisma.message.createMany({
    data: [
      { text: "pushed the diff viewer, can someone review?", channelId: deployments.id, userId: PN.id },
      { text: "on it, taking a look now", channelId: deployments.id, userId: AK.id },
      { text: "thanks — mainly want eyes on the tokenizer edge cases", channelId: deployments.id, userId: PN.id },
    ],
  });

  console.log("Seeded. Login with any of:");
  seedUsers.forEach((u) => console.log(`  ${u.email} / password123  (${u.role})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
