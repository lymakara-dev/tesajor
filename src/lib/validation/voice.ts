import { z } from "zod";
import { VOICE_LOCALES } from "@/lib/voice/phrases";

export const getVoiceClipsSchema = z.object({
  tripId: z.string().uuid(),
  dayNumber: z.number().int().min(1).max(365),
});

export const setVoicePreferencesSchema = z.object({
  enabled: z.boolean(),
  locale: z.enum(VOICE_LOCALES),
});
