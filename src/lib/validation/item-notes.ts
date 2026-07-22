import { z } from "zod";

export const itemNoteTagSchema = z.enum(["environment", "scenery", "food", "price", "tip"]);

export const addItemNoteSchema = z.object({
  agendaItemId: z.uuid(),
  mood: z.number().int().min(1).max(5).optional(),
  noteText: z.string().trim().max(2000).optional(),
  tags: z.array(itemNoteTagSchema).max(5).optional(),
  actualCostCents: z.number().int().nonnegative().optional(),
  photoUrls: z.array(z.string().trim().min(1).max(2048)).max(10).optional(),
});

export type AddItemNoteInput = z.infer<typeof addItemNoteSchema>;
