import { z } from "zod";

export const geofenceSettingsSchema = z.object({
  latitude: z.coerce
    .number({ error: "Informe uma latitude v\u00e1lida." })
    .min(-90, "A latitude deve ficar entre -90 e 90.")
    .max(90, "A latitude deve ficar entre -90 e 90."),
  longitude: z.coerce
    .number({ error: "Informe uma longitude v\u00e1lida." })
    .min(-180, "A longitude deve ficar entre -180 e 180.")
    .max(180, "A longitude deve ficar entre -180 e 180."),
  radiusMeters: z.coerce
    .number({ error: "Informe um raio v\u00e1lido." })
    .int("O raio precisa ser um n\u00famero inteiro.")
    .min(10, "O raio m\u00ednimo \u00e9 10 metros.")
    .max(5_000, "O raio m\u00e1ximo \u00e9 5.000 metros."),
});

export type GeofenceSettingsInput = z.infer<typeof geofenceSettingsSchema>;
