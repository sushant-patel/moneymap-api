import { prisma } from "../lib/prisma.js";
import { createSettlementSchema } from "../validators/settlement.schema.js";
import { logActivity } from "../services/activity.js";

export async function createSettlement(req, res) {
    // 1. VALIDATE INPUT
    const parsed = createSettlementSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        });
    }
    const { toUserId, amount } = parsed.data;
    const fromUserId = parsed.data.fromUserId ?? req.user.id; // default: the logged-in user paid
    const groupId = req.params.id;

    // 2. CHECK RULES
    if (fromUserId === toUserId) {
        return res.status(400).json({ error: "You can't settle with yourself" });
    }

    // Both people must be in this group (and we grab their names for the log)
    const people = await prisma.groupMember.findMany({
        where: { groupId, userId: { in: [fromUserId, toUserId] } },
        include: { user: { select: { name: true } } },
    });
    if (people.length !== 2) {
        return res.status(400).json({ error: "Both people must be members of this group" });
    }
    const nameOf = (id) => people.find((p) => p.userId === id).user.name;

    // 3 + 4. SAVE AND LOG TOGETHER
    const settlement = await prisma.$transaction(async (tx) => {
        const created = await tx.settlement.create({
            data: { groupId, fromUserId, toUserId, amount },
        });

        await logActivity(tx, {
            groupId,
            actorId: req.user.id,
            type: "SETTLEMENT_CREATED",
            details: { from: nameOf(fromUserId), to: nameOf(toUserId), amount },
        });

        return created;
    });

    // 5. RESPOND
    res.status(201).json(settlement);
}