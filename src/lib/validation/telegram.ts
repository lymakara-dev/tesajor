import { z } from "zod";

export const telegramWidgetAuthSchema = z.object({
  id: z.union([z.string(), z.number()]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.string(), z.number()]),
  hash: z.string(),
});

export type TelegramWidgetAuthInput = z.infer<typeof telegramWidgetAuthSchema>;
