import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES).default("USD"),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1),
});
