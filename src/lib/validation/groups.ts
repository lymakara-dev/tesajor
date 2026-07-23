import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES).default("USD"),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

export const updateGroupExchangeRateSchema = z.object({
  groupId: z.uuid(),
  // Riel per 1 USD. Upper bound is a sanity ceiling, not a real-world
  // limit — rejects fat-fingered entries like "410000" (a misplaced
  // zero) without constraining legitimate future rates.
  usdKhrRate: z.coerce.number().int().positive().max(1_000_000),
});
