import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseCurrency: z.string().length(3).default("USD"),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1),
});
