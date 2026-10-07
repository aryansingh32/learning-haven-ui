import { z } from 'zod';

export const autosaveAnswerSchema = z.object({
  body: z.object({
    selectedOptions: z.array(z.string()).nullable().optional(),
    natValue: z.number().nullable().optional(),
    markedForReview: z.boolean().optional(),
  }),
});
