import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";

export const tripVisibilitySchema = z.enum(["private", "link", "public_template"]);

export const createTripSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    baseCurrency: z.enum(SUPPORTED_CURRENCIES).default("USD"),
    groupId: z.uuid().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const publishTripSchema = z.object({
  tripId: z.uuid(),
  visibility: tripVisibilitySchema,
});

export const joinTripSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

export const cloneTripSchema = z.object({
  tripId: z.uuid(),
  newStartDate: z.coerce.date(),
});

export const updateTripExchangeRateSchema = z.object({
  tripId: z.uuid(),
  // Riel per 1 USD — see updateGroupExchangeRateSchema's comment.
  usdKhrRate: z.coerce.number().int().positive().max(1_000_000),
});
