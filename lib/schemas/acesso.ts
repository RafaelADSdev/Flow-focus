import { z } from "zod";
import { defaultPaginasForPerfil, normalizePaginasAcesso, paginaAcessoValues } from "@/lib/auth/paginas-acesso";

export const perfilAcessoSchema = z.enum(["corretor", "lider", "diretora", "admin"]);

const acessoBaseSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string().min(6, "A senha temporária precisa de pelo menos 6 caracteres."),
  perfil: perfilAcessoSchema,
  esteira: z.literal("geral"),
  equipeId: z.string().uuid().nullable(),
  paginasAcesso: z.array(z.enum(paginaAcessoValues)).min(1, "Selecione ao menos uma página."),
});

function validarAcesso(
  data: {
    perfil: z.infer<typeof perfilAcessoSchema>;
    equipeId: string | null;
    paginasAcesso: string[];
  },
  ctx: z.RefinementCtx,
) {
  if (["corretor", "lider"].includes(data.perfil) && !data.equipeId) {
    ctx.addIssue({ code: "custom", message: "Líderes e corretores precisam de uma equipe.", path: ["equipeId"] });
  }

  const normalized = normalizePaginasAcesso(data.perfil, data.paginasAcesso);
  if (!normalized.length) {
    ctx.addIssue({ code: "custom", message: "Selecione ao menos uma página.", path: ["paginasAcesso"] });
  }
}

export const novoAcessoSchema = acessoBaseSchema
  .transform((data) => ({
    ...data,
    paginasAcesso: normalizePaginasAcesso(data.perfil, data.paginasAcesso),
  }))
  .superRefine(validarAcesso);

export type NovoAcessoInput = z.infer<typeof novoAcessoSchema>;

export const editarAcessoSchema = acessoBaseSchema
  .omit({ email: true })
  .extend({
    id: z.string().uuid(),
    senha: z.union([z.literal(""), z.string().min(6, "A senha temporária precisa de pelo menos 6 caracteres.")]),
  })
  .transform((data) => ({
    ...data,
    paginasAcesso: normalizePaginasAcesso(data.perfil, data.paginasAcesso),
  }))
  .superRefine(validarAcesso);

export type EditarAcessoInput = z.infer<typeof editarAcessoSchema>;

export const perfilLabels: Record<z.infer<typeof perfilAcessoSchema>, string> = {
  corretor: "Corretor",
  lider: "Líder",
  diretora: "Diretora",
  admin: "Administrador",
};

export const esteiraDashboardLabel = "Comercial Geral";

export { defaultPaginasForPerfil };
