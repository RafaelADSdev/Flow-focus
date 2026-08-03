import { describe, expect, it } from "vitest";
import { isContaDemonstracao } from "@/lib/auth/conta-demonstracao";

describe("isContaDemonstracao", () => {
  it("detecta corretor de homologação pelo nome", () => {
    expect(isContaDemonstracao({ nome: "Corretor - TESTE" })).toBe(true);
  });

  it("ignora corretores reais", () => {
    expect(isContaDemonstracao({ nome: "Adauto Anderson Lins dos Anjos" })).toBe(false);
  });

  it("detecta e-mail de teste", () => {
    expect(isContaDemonstracao({ email: "teste@hubon.com.br" })).toBe(true);
  });
});
