import { describe, expect, it } from "vitest";
import {
  displayNameFromBitrix,
  displayNameFromEmail,
  resolveUserDisplayName,
} from "./user-display-name";

describe("user-display-name", () => {
  it("prioriza o nome completo informado pelo Bitrix", () => {
    expect(resolveUserDisplayName({
      bitrixUser: { NAME: "  Rafael ", SECOND_NAME: "de", LAST_NAME: "Arcanjo  " },
      existingName: "rafael.arcanjo",
      email: "rafael.arcanjo@example.com",
    })).toBe("Rafael de Arcanjo");
  });

  it("preserva o nome existente quando o Bitrix não informa nome", () => {
    expect(resolveUserDisplayName({
      bitrixUser: { NAME: "", LAST_NAME: null },
      existingName: "Rafael Arcanjo",
      email: "rafael.arcanjo@example.com",
    })).toBe("Rafael Arcanjo");
  });

  it("usa o e-mail como último fallback", () => {
    expect(displayNameFromEmail("rafael.arcanjo@example.com")).toBe("Rafael Arcanjo");
    expect(resolveUserDisplayName({ email: "maria-jose@example.com" })).toBe("Maria Jose");
  });

  it("normaliza espaços no nome vindo do Bitrix", () => {
    expect(displayNameFromBitrix({ NAME: "Ana   Maria", LAST_NAME: " Silva " })).toBe("Ana Maria Silva");
  });

  it("não duplica o segundo nome quando o Bitrix já o inclui em NAME", () => {
    expect(displayNameFromBitrix({
      NAME: "Anderson Soares",
      SECOND_NAME: "Soares",
      LAST_NAME: "Cabral",
    })).toBe("Anderson Soares Cabral");
  });
});
