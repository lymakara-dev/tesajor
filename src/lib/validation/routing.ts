import { z } from "zod";
import { ROUTING_PROFILES } from "@/lib/routing/ors";

export const getDayRoutesSchema = z.object({
  tripId: z.string().uuid(),
  dayNumber: z.number().int().min(1).max(365),
  profile: z.enum(ROUTING_PROFILES).default("driving-car"),
});

export type GetDayRoutesInput = z.infer<typeof getDayRoutesSchema>;
