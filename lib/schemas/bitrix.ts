import { z } from "zod";

export const bitrixWebhookSchema = z.object({
  event: z.string().min(1),
  event_id: z.string().min(1).optional(),
  data: z.object({
    FIELDS: z.object({ ID: z.coerce.string().min(1) }).passthrough(),
  }).passthrough(),
  auth: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type BitrixWebhookPayload = z.infer<typeof bitrixWebhookSchema>;
