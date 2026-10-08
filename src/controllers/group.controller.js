import { prisma } from "../lib/prisma.js";
import { logActivity } from "../services/activity.js";
import { computeBalances } from "../services/balances.js";
import { simplifyDebts } from "../services/simplify.js";

export async function createGroup(req, res) {
  const { name } = req.body ?? {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Group name is required" });
  }

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        name: name.trim(),
        members: { create: { userId: req.user.id } },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await logActivity(tx, {
      groupId: created.id,
      actorId: req.user.id,
      type: "GROUP_CREATED",
      details: { name: created.name },
    });

    return created;
  });

  res.status(201).json(group);
}

export async function getMyGroups(req, res) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json(groups);
}

export async function getGroup(req, res) {
  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  res.json(group);
}

export async function addMember(req, res) {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: "No user with that email" });
  }

  const already = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: user.id } },
  });
  if (already) {
    return res.status(409).json({ error: "User is already in this group" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: { groupId: req.params.id, userId: user.id },
    });

    await logActivity(tx, {
      groupId: req.params.id,
      actorId: req.user.id,
      type: "MEMBER_ADDED",
      details: { memberId: user.id, memberName: user.name },
    });
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email });
}

export async function listActivity(req, res) {
  const activities = await prisma.activity.findMany({
    where: { groupId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, name: true } } },
  });

  res.json(activities);
}

export async function getBalances(req, res) {
  const balances = await computeBalances(req.params.id);

  // Safety check: balances must always add up to zero
  const total = balances.reduce((sum, b) => sum + b.balance, 0);
  if (total !== 0) {
    console.error(`⚠️ Balances for group ${req.params.id} add up to ${total}, not 0`);
  }

  res.json(balances);
}

export async function getSimplifiedDebts(req, res) {
  const balances = await computeBalances(req.params.id);
  res.json(simplifyDebts(balances));
}