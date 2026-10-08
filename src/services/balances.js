import { prisma } from "../lib/prisma.js";

export async function computeBalances(groupId) {
  // groupBy makes Postgres add up the totals for us
  const [members, paid, owed, sent, received] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { name: true } } },
    }),
    prisma.expensePayer.groupBy({
      by: ["userId"],
      where: { expense: { groupId, deletedAt: null } },
      _sum: { amountPaid: true },
    }),
    prisma.expenseSplit.groupBy({
      by: ["userId"],
      where: { expense: { groupId, deletedAt: null } },
      _sum: { amountOwed: true },
    }),
    prisma.settlement.groupBy({ by: ["fromUserId"], where: { groupId }, _sum: { amount: true } }),
    prisma.settlement.groupBy({ by: ["toUserId"], where: { groupId }, _sum: { amount: true } }),
  ]);

  const balances = new Map(
    members.map((m) => [m.userId, { userId: m.userId, name: m.user.name, balance: 0 }])
  );
  const add = (userId, amount) => {
    const entry = balances.get(userId);
    if (entry) entry.balance += amount;
  };

  // balance = paid − owed + sent − received
  paid.forEach((p) => add(p.userId, p._sum.amountPaid ?? 0));
  owed.forEach((o) => add(o.userId, -(o._sum.amountOwed ?? 0)));
  sent.forEach((s) => add(s.fromUserId, s._sum.amount ?? 0));
  received.forEach((r) => add(r.toUserId, -(r._sum.amount ?? 0)));

  return [...balances.values()];
}