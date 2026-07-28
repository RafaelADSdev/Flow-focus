import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth";
import { auditoriaSchema } from "./auditoria";
import { bitrixWebhookSchema } from "./bitrix";
import { editarAcessoSchema, novoAcessoSchema } from "./acesso";
import { passwordFromBitrixId } from "../auth/bitrix-password";
import { normalizePaginasAcesso } from "../auth/paginas-acesso";

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

  it("carrega os schemas de criacao e edicao de acesso no Zod 4", () => {
    const equipeId = "45fbad56-6064-4b60-98b0-9b7ef75ab001";

    expect(novoAcessoSchema.safeParse({
      email: "corretor@focus.com.br",
      senha: "senha123",
      perfil: "corretor",
      esteira: "geral",
      equipeId,
      paginasAcesso: ["/corretor"],
    }).success).toBe(true);

    expect(editarAcessoSchema.safeParse({
      id: "15b86593-affb-4c90-ba4c-8d2daf2ec97b",
      senha: "",
      perfil: "admin",
      esteira: "geral",
      equipeId: null,
      paginasAcesso: ["/dashboard", "/configuracoes"],
    }).success).toBe(true);

    expect(editarAcessoSchema.safeParse({
      id: "15b86593-affb-4c90-ba4c-8d2daf2ec97b",
      senha: "nova-senha",
      perfil: "admin",
      esteira: "geral",
      equipeId: null,
      paginasAcesso: ["/dashboard", "/configuracoes"],
    }).success).toBe(true);
  });

  it("mantem equipe obrigatoria para lideres e corretores", () => {
    const result = editarAcessoSchema.safeParse({
      id: "15b86593-affb-4c90-ba4c-8d2daf2ec97b",
      senha: "",
      perfil: "lider",
      esteira: "geral",
      equipeId: null,
      paginasAcesso: ["/roletas", "/equipe", "/auditorias", "/dashboard"],
    });

    expect(result.success).toBe(false);
  });

  it("gera senha de seis digitos a partir do ID do Bitrix", () => {
    expect(passwordFromBitrixId("1326")).toBe("001326");
    expect(passwordFromBitrixId("123456")).toBe("123456");
    expect(() => passwordFromBitrixId("13A6")).toThrow("ID do Bitrix inválido.");
  });

  it("remove rotas ocultas do conjunto salvo", () => {
    expect(normalizePaginasAcesso("lider", ["/roletas", "/comercial-geral", "/auditorias", "/dashboard"]))
      .toEqual(["/corretor", "/roletas", "/auditorias", "/dashboard"]);
  });

  it("mantém Minha carteira como entrada de todos os perfis", () => {
    expect(normalizePaginasAcesso("lider", ["/equipe"]))
      .toEqual(["/corretor", "/equipe"]);
    expect(normalizePaginasAcesso("diretora", ["/dashboard"]))
      .toEqual(["/corretor", "/dashboard"]);
  });

  it("não troca carteira vazia do corretor por outra página", () => {
    expect(normalizePaginasAcesso("corretor", [])).toEqual(["/corretor"]);
    expect(normalizePaginasAcesso("corretor", null)).toEqual(["/corretor"]);
  });
});
