import { prisma } from "../lib/prisma.js";
import { createExpenseSchema } from "../validators/expense.schema.js";
import { calculateSplits } from "../services/splits.js";
import { logActivity } from "../services/activity.js";

export async function createExpense(req, res) {
  // 1. VALIDATE INPUT
  const parsed = createExpenseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  const { description, amount, splitType, splits } = parsed.data;
  const payers = parsed.data.payers ?? [{ userId: req.user.id, amount }];
  const groupId = req.params.id;

  // 2. CHECK RULES
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const memberIds = new Set(members.map((m) => m.userId));

  // Payers: no duplicates, all members, and they must cover the full bill
  const payerIds = payers.map((p) => p.userId);
  if (new Set(payerIds).size !== payerIds.length) {
    return res.status(400).json({ error: "A payer appears more than once" });
  }
  if (payerIds.some((id) => !memberIds.has(id))) {
    return res.status(400).json({ error: "All payers must be group members" });
  }
  const payerTotal = payers.reduce((sum, p) => sum + p.amount, 0);
  if (payerTotal !== amount) {
    return res.status(400).json({
      error: `Payers add up to ${payerTotal}, but the expense is ${amount}`,
    });
  }

  // Splits: no duplicates, all members
  const splitUserIds = splits.map((s) => s.userId);
  if (new Set(splitUserIds).size !== splitUserIds.length) {
    return res.status(400).json({ error: "A user appears more than once in splits" });
  }
  if (splitUserIds.some((id) => !memberIds.has(id))) {
    return res.status(400).json({ error: "Everyone in splits must be a group member" });
  }

  const computed = calculateSplits(amount, splitType, splits);

  // 3 + 4. CREATE EXPENSE, PAYERS, SPLITS AND LOG, ALL IN ONE TRANSACTION
  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        description, amount, splitType, groupId,
        payers: { create: payers.map((p) => ({ userId: p.userId, amountPaid: p.amount })) },
        splits: { create: computed },
      },
      include: { payers: true, splits: true },
    });

    await logActivity(tx, {
      groupId,
      actorId: req.user.id,
      type: "EXPENSE_CREATED",
      expenseId: created.id,
      details: { description, amount },
    });

    return created;
  });

  // 5. RESPOND
  res.status(201).json(expense);
}

export async function listExpenses(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const where = { groupId: req.params.id, deletedAt: null };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        payers: { include: { user: { select: { id: true, name: true } } } },
        splits: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ expenses, page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function deleteExpense(req, res) {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.id, deletedAt: null },
  });

  if (!expense) {
    return res.status(404).json({ error: "Expense not found in this group" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expense.id },
      data: { deletedAt: new Date() },
    });

    await logActivity(tx, {
      groupId: expense.groupId,
      actorId: req.user.id,
      type: "EXPENSE_DELETED",
      expenseId: expense.id,
      details: { description: expense.description, amount: expense.amount },
    });
  });

  res.status(204).send();
}

export async function listDeletedExpenses(req, res) {
  const expenses = await prisma.expense.findMany({
    where: { groupId: req.params.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });
  res.json(expenses);
}

export async function restoreExpense(req, res) {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.id, deletedAt: { not: null } },
  });
  if (!expense) {
    return res.status(404).json({ error: "Deleted expense not found" });
  }

  const restored = await prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: { deletedAt: null },
    });

    await logActivity(tx, {
      groupId: expense.groupId,
      actorId: req.user.id,
      type: "EXPENSE_RESTORED",
      expenseId: expense.id,
      details: { description: expense.description, amount: expense.amount },
    });

    return updated;
  });

  res.json(restored);
}

export async function purgeExpense(req, res) {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.expenseId, groupId: req.params.id, deletedAt: { not: null } },
  });
  if (!expense) {
    return res.status(404).json({ error: "Expense must be in the bin before permanent delete" });
  }

  await prisma.$transaction(async (tx) => {
    await logActivity(tx, {
      groupId: expense.groupId,
      actorId: req.user.id,
      type: "EXPENSE_PURGED",
      expenseId: expense.id,
      details: { description: expense.description, amount: expense.amount },
    });

    await tx.expense.delete({ where: { id: expense.id } });
  });

  res.status(204).send();
}