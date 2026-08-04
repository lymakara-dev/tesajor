import { z } from "zod";
import { PLACE_CATEGORIES } from "@/lib/places/overpass";

export const placeCategorySchema = z.enum(PLACE_CATEGORIES);

export const getNearbyPlacesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: placeCategorySchema,
});

export type GetNearbyPlacesInput = z.infer<typeof getNearbyPlacesSchema>;
