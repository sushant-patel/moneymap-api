import { z } from "zod";

export const createSettlementSchema = z.object({
    fromUserId: z.string().optional(), // missing = the logged-in user paid
    toUserId: z.string(),
    amount: z.number().int().positive(),
});