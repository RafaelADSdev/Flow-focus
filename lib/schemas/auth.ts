import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres."),
});

export type LoginInput = z.infer<typeof loginSchema>;
