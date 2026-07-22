import { z } from "zod";

export const agendaItemCategorySchema = z.enum([
  "food",
  "sight",
  "transport",
  "hotel",
  "activity",
  "other",
]);

export const addAgendaItemSchema = z.object({
  tripId: z.uuid(),
  dayNumber: z.number().int().min(1),
  title: z.string().trim().min(1).max(160),
  category: agendaItemCategorySchema.default("other"),
  plannedStart: z.coerce.date().optional(),
  plannedEnd: z.coerce.date().optional(),
  plannedCostCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).default("USD"),
  placeName: z.string().trim().max(200).optional(),
  placeId: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().trim().max(300).optional(),
});

export type AddAgendaItemInput = z.infer<typeof addAgendaItemSchema>;

export const updateAgendaItemSchema = addAgendaItemSchema.and(
  z.object({ itemId: z.uuid() }),
);

export const reorderAgendaItemsSchema = z.object({
  tripId: z.uuid(),
  dayNumber: z.number().int().min(1),
  orderedItemIds: z.array(z.uuid()).min(1),
});

export const completeAgendaItemSchema = z.object({ itemId: z.uuid() });
export const skipAgendaItemSchema = z.object({ itemId: z.uuid() });
export const resetAgendaItemSchema = z.object({ itemId: z.uuid() });
