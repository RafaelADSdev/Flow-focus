export const DAY_MS = 86_400_000;
export const ROULETTE_FIELD = process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972";
export const PRAZO_PADRAO_FIELD = "UF_CRM_1726060110";
export const PRAZO_QUARENTENA_FIELD = "UF_CRM_1726060130";
export const DEAL_STATUS_FIELD = "UF_CRM_1717073472";
const DEFAULT_QUARANTINE_STATUS_VALUE = "4128";

export type CriticalDealInput = {
  DATE_MODIFY: string;
  STAGE_ID: string;
  UF_CRM_1726060110?: string | null;
  UF_CRM_1726060130?: string | null;
  UF_CRM_1726667595972?: string | null;
  UF_CRM_1717073472?: string | number | null;
  [key: string]: unknown;
};

export function isDealQuarantineStatus(value: unknown) {
  if (value == null) return false;
  const normalized = String(value).trim();
  if (!normalized) return false;
  if (normalized.toUpperCase() === "EM QUARENTENA") return true;
  const quarantineValue = (process.env.BITRIX24_QUARANTINE_STATUS_VALUE ?? DEFAULT_QUARANTINE_STATUS_VALUE).trim();
  return normalized === quarantineValue;
}

export function isWonDealStage(stageId: string, stageSemantic?: string | null) {
  if (String(stageSemantic ?? "").toUpperCase() === "S") return true;
  return /WON/i.test(stageId);
}

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

export function parseBitrixDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function prazoPadraoDate(deal: CriticalDealInput) {
  return parseBitrixDate(deal.UF_CRM_1726060110);
}

export function prazoQuarentenaDate(deal: CriticalDealInput) {
  const raw = deal[PRAZO_QUARENTENA_FIELD] ?? deal.UF_CRM_1726060130;
  return parseBitrixDate(raw);
}

export function activeCriticalDeadline(deal: CriticalDealInput, stageName: string) {
  if (isDealQuarantineStatus(deal.UF_CRM_1717073472)) return prazoQuarentenaDate(deal);
  if (isEmAndamentoStageName(stageName)) return prazoPadraoDate(deal);
  return null;
}

export function criticalDeadlineSource(
  deal: CriticalDealInput,
  stageName: string,
): "quarentena" | "padrao" | null {
  if (isDealQuarantineStatus(deal.UF_CRM_1717073472) && prazoQuarentenaDate(deal)) return "quarentena";
  if (isEmAndamentoStageName(stageName) && prazoPadraoDate(deal)) return "padrao";
  return null;
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
  const prazo = activeCriticalDeadline(deal, stageName);
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
