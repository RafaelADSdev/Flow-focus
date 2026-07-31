import type { PerfilUsuario } from "@/lib/database.types";

export const captureAvailabilityValues = [
  "disponivel",
  "perfil_sem_captura",
  "sem_permissao_roleta",
  "sem_roleta_ativa",
  "sem_oportunidades",
  "dados_indisponiveis",
] as const;

export type DisponibilidadeCaptura = (typeof captureAvailabilityValues)[number];

export function resolveCaptureAvailability(input: {
  perfil: PerfilUsuario;
  roletasPermitidas: number;
  roletasAtivasDeCaptura: number;
  oportunidadesDisponiveis: number;
}): DisponibilidadeCaptura {
  if (input.perfil !== "corretor") return "perfil_sem_captura";
  if (input.roletasPermitidas <= 0) return "sem_permissao_roleta";
  if (input.roletasAtivasDeCaptura <= 0) return "sem_roleta_ativa";
  if (input.oportunidadesDisponiveis <= 0) return "sem_oportunidades";
  return "disponivel";
}
