import { z } from "zod";
import { uploadPathSchema } from "@/lib/validation/upload-path";

const payerSchema = z.object({
  memberId: z.uuid(),
  paidAmountCents: z.number().int().positive(),
});

const baseExpenseFields = {
  groupId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  totalAmountCents: z.number().int().positive(),
  currency: z.string().trim().length(3),
  category: z.string().trim().max(60).optional(),
  note: z.string().trim().max(2000).optional(),
  // Same-origin path from our upload route only — rendered directly as an
  // <a href> on the group page, so an unrestricted string here would let a
  // "javascript:" value execute in any group member's session when they
  // click the receipt link.
  receiptUrl: uploadPathSchema.optional(),
  expenseDate: z.coerce.date(),
  payers: z.array(payerSchema).min(1),
};

const equalExpenseSchema = z.object({
  ...baseExpenseFields,
  splitMethod: z.literal("equal"),
  participantMemberIds: z.array(z.uuid()).min(1),
});

const exactExpenseSchema = z.object({
  ...baseExpenseFields,
  splitMethod: z.literal("exact"),
  shares: z
    .array(
      z.object({
        memberId: z.uuid(),
        owedAmountCents: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

const percentExpenseSchema = z.object({
  ...baseExpenseFields,
  splitMethod: z.literal("percent"),
  shares: z
    .array(
      z.object({
        memberId: z.uuid(),
        percentBasisPoints: z.number().int().positive().max(10000),
      }),
    )
    .min(1),
});

const sharesExpenseSchema = z.object({
  ...baseExpenseFields,
  splitMethod: z.literal("shares"),
  shares: z
    .array(
      z.object({
        memberId: z.uuid(),
        shareCount: z.number().int().positive(),
      }),
    )
    .min(1),
});

const itemizedExpenseSchema = z.object({
  ...baseExpenseFields,
  splitMethod: z.literal("itemized"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        priceCents: z.number().int().nonnegative(),
        assigneeMemberIds: z.array(z.uuid()).min(1),
      }),
    )
    .min(1),
});

export const createExpenseSchema = z.discriminatedUnion("splitMethod", [
  equalExpenseSchema,
  exactExpenseSchema,
  percentExpenseSchema,
  sharesExpenseSchema,
  itemizedExpenseSchema,
]);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  expenseId: z.uuid(),
  expense: createExpenseSchema,
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const deleteExpenseSchema = z.object({
  expenseId: z.uuid(),
});
