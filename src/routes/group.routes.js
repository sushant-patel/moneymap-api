import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { requireGroupMember } from "../middleware/groupMember.js";
import { createSettlement } from "../controllers/settlement.controller.js";
import {
    createGroup, getMyGroups, getGroup, addMember, listActivity, getBalances,
    getSimplifiedDebts,
} from "../controllers/group.controller.js";
import {
    createExpense, listExpenses, deleteExpense,
    listDeletedExpenses, restoreExpense, purgeExpense,
} from "../controllers/expense.controller.js";

const router = Router();

router.use(authenticate);

// Groups
router.post("/", createGroup);
router.get("/", getMyGroups);
router.get("/:id", requireGroupMember, getGroup);
router.post("/:id/members", requireGroupMember, addMember);
router.get("/:id/activity", requireGroupMember, listActivity);

// Expenses
router.post("/:id/expenses", requireGroupMember, createExpense);
router.get("/:id/expenses", requireGroupMember, listExpenses);
router.get("/:id/expenses/deleted", requireGroupMember, listDeletedExpenses);
router.delete("/:id/expenses/:expenseId", requireGroupMember, deleteExpense);

// Recycle bin
router.post("/:id/expenses/:expenseId/restore", requireGroupMember, restoreExpense);
router.delete("/:id/expenses/:expenseId/permanent", requireGroupMember, purgeExpense);

// Balances
router.get("/:id/balances", requireGroupMember, getBalances);

// Settlements
router.post("/:id/settlements", requireGroupMember, createSettlement);

router.get("/:id/simplified-debts", requireGroupMember, getSimplifiedDebts);

export default router;