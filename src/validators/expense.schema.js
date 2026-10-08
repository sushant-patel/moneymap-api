import { z } from "zod";

export const createExpenseSchema = z.object({
    description: z.string().trim().min(1).max(100),
    amount: z.number().int().positive(),
    splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]),

    // Who put money in: one or more people, each with how much they paid
    payers: z
        .array(z.object({
            userId: z.string(),
            amount: z.number().int().positive(),
        }))
        .min(1)
        .optional(),

    // Who shares the cost
    splits: z
        .array(z.object({
            userId: z.string(),
            value: z.number().positive().optional(),
        }))
        .min(1),
});