export function logActivity(db, { groupId, actorId, type, expenseId = null, details = {} }) {
    return db.activity.create({
        data: { groupId, actorId, type, expenseId, details },
    });
}