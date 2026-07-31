import { describe, expect, it } from "vitest";
import { resolveCaptureAvailability } from "@/lib/capture-availability";

describe("resolveCaptureAvailability", () => {
  it("mantém a carteira como consulta para perfis que não captam", () => {
    expect(resolveCaptureAvailability({
      perfil: "lider",
      roletasPermitidas: 2,
      roletasAtivasDeCaptura: 2,
      oportunidadesDisponiveis: 5,
    })).toBe("perfil_sem_captura");
  });

  it("distingue acesso ausente, roleta inativa e fila vazia", () => {
    expect(resolveCaptureAvailability({
      perfil: "corretor",
      roletasPermitidas: 0,
      roletasAtivasDeCaptura: 0,
      oportunidadesDisponiveis: 0,
    })).toBe("sem_permissao_roleta");

    expect(resolveCaptureAvailability({
      perfil: "corretor",
      roletasPermitidas: 1,
      roletasAtivasDeCaptura: 0,
      oportunidadesDisponiveis: 0,
    })).toBe("sem_roleta_ativa");

    expect(resolveCaptureAvailability({
      perfil: "corretor",
      roletasPermitidas: 1,
      roletasAtivasDeCaptura: 1,
      oportunidadesDisponiveis: 0,
    })).toBe("sem_oportunidades");
  });

  it("libera apenas corretor com roleta de captação e fila disponível", () => {
    expect(resolveCaptureAvailability({
      perfil: "corretor",
      roletasPermitidas: 1,
      roletasAtivasDeCaptura: 1,
      oportunidadesDisponiveis: 1,
    })).toBe("disponivel");
  });
});
