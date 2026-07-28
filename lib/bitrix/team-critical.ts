export const DAY_MS = 86_400_000;
export const ROULETTE_FIELD = process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972";
export const PRAZO_PADRAO_FIELD = "UF_CRM_1726060110";

export type CriticalDealInput = {
  DATE_MODIFY: string;
  STAGE_ID: string;
  UF_CRM_1726060110?: string | null;
  UF_CRM_1726667595972?: string | null;
  [key: string]: unknown;
};

export function hasRoletaAtual(deal: CriticalDealInput) {
  const raw = deal[ROULETTE_FIELD] ?? deal.UF_CRM_1726667595972;
  return Boolean(String(raw ?? "").trim());
}

export function daysAgo(iso: string, now = Date.now()) {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : Math.max(0, Math.floor((now - value) / DAY_MS));
}

export function isEmAndamentoStageName(name: string) {
  const normalized = name.trim().toLowerCase();
  return /andamento/.test(normalized) || /em atendimento/.test(normalized);
}

export function prazoPadraoDate(deal: CriticalDealInput) {
  const raw = deal.UF_CRM_1726060110;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type CriticalAssessment = {
  critical: boolean;
  stagnant: boolean;
  expiringSoon: boolean;
  deadline: Date | null;
  daysStagnated: number;
  msRemaining: number;
};

export function isDueRdStationLead(parts: {
  title?: string | null;
  sourceName?: string | null;
  roletaAtual?: string | null;
}) {
  const blob = [parts.title, parts.sourceName, parts.roletaAtual]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (!blob) return false;
  if (/\bDUE\b/i.test(blob)) return true;
  return /DUE.*RD\s*STATION|RD\s*STATION.*DUE/i.test(blob);
}

export function assessCriticalDeal(
  deal: CriticalDealInput,
  stageName: string,
  options: { lostStage?: boolean; now?: number } = {},
): CriticalAssessment {
  const now = options.now ?? Date.now();
  const daysStagnated = daysAgo(deal.DATE_MODIFY, now);
  const empty: CriticalAssessment = {
    critical: false,
    stagnant: false,
    expiringSoon: false,
    deadline: null,
    daysStagnated,
    msRemaining: 0,
  };

  if (!hasRoletaAtual(deal) || options.lostStage) return empty;

  const stagnant = daysStagnated > 2;
  const prazo = isEmAndamentoStageName(stageName) ? prazoPadraoDate(deal) : null;
  const inSevenDays = now + 7 * DAY_MS;
  const expiringSoon = Boolean(prazo && prazo.getTime() <= inSevenDays);
  const msRemaining = prazo ? prazo.getTime() - now : 0;

  return {
    critical: stagnant || expiringSoon,
    stagnant,
    expiringSoon,
    deadline: expiringSoon ? prazo : null,
    daysStagnated,
    msRemaining,
  };
}
