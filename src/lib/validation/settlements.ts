import { z } from "zod";

export const recordSettlementSchema = z
  .object({
    groupId: z.uuid(),
    fromMemberId: z.uuid(),
    toMemberId: z.uuid(),
    amountCents: z.number().int().positive(),
    method: z.string().trim().max(60).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.fromMemberId !== data.toMemberId, {
    message: "A member can't settle up with themselves.",
    path: ["toMemberId"],
  });

export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;
