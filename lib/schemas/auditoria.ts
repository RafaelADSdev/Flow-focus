import { z } from "zod";

export const criterioSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  atendido: z.boolean(),
});

export const auditoriaSchema = z.object({
  auditoriaId: z.string().uuid(),
  status: z.enum(["aprovado", "reprovado"]),
  observacoes: z.string().trim().max(1500),
  criterios: z.array(criterioSchema).min(1),
});
