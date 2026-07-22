import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth";
import { auditoriaSchema } from "./auditoria";
import { bitrixWebhookSchema } from "./bitrix";

describe("schemas compartilhados", () => {
  it("aceita um login corporativo valido", () => {
    expect(loginSchema.parse({ email: "lider@focus.com.br", password: "flowfocus" })).toEqual({
      email: "lider@focus.com.br",
      password: "flowfocus",
    });
  });

  it("rejeita webhook do Bitrix sem ID do negocio", () => {
    expect(() => bitrixWebhookSchema.parse({ event: "ONCRMDEALUPDATE", data: { FIELDS: {} } })).toThrow();
  });

  it("exige ao menos um criterio na auditoria", () => {
    const result = auditoriaSchema.safeParse({
      auditoriaId: "a1d8fbe0-2a84-4d79-9ba4-0356cac8e639",
      status: "aprovado",
      observacoes: "Carteira organizada",
      criterios: [],
    });
    expect(result.success).toBe(false);
  });
});
