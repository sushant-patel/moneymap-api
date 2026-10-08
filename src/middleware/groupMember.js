import { prisma } from "../lib/prisma.js";

export async function requireGroupMember(req, res, next) {
    const membership = await prisma.groupMember.findUnique({
        where: {
            groupId_userId: { groupId: req.params.id, userId: req.user.id },
        },
    });

    if (!membership) {
        return res.status(403).json({ error: "You are not a member of this group" });
    }

    next();
}