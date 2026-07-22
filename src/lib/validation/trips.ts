import { z } from "zod";

export const tripVisibilitySchema = z.enum(["private", "link", "public_template"]);

export const createTripSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    baseCurrency: z.string().trim().length(3).default("USD"),
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
