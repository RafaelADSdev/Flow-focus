import { esteiraDashboardLabel } from "@/lib/schemas/acesso";

export const DASHBOARD_PERIOD_DEFAULT = 60;

export type DashboardQuickPreset = "hoje" | "7" | "30" | "60";

export type DashboardFilters = {
  de: string;
  ate: string;
  esteira: string;
  diretoria: string;
  equipe: string;
  corretor: string;
  roleta: string;
};

export type DashboardFilterOptions = {
  esteiras: Array<{ id: string; label: string }>;
  diretorias: Array<{ id: string; label: string }>;
  equipes: Array<{ id: string; nome: string; diretoriaId: string | null }>;
  corretores: Array<{ id: string; nome: string; equipeId: string | null }>;
  /** Valores distintos de oportunidades.roleta_atual (Bitrix UF_CRM_1726667595972). */
  roletas: Array<{ value: string; label: string }>;
};

const ESTEIRA_LABELS: Record<string, string> = {
  "16": esteiraDashboardLabel,
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function todayIsoDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return toIsoDate(today);
}

export function presetRange(preset: DashboardQuickPreset): Pick<DashboardFilters, "de" | "ate"> {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);

  if (preset === "hoje") {
    return { de: toIsoDate(start), ate: toIsoDate(end) };
  }

  const days = preset === "7" ? 7 : preset === "30" ? 30 : 60;
  start.setDate(start.getDate() - (days - 1));
  return { de: toIsoDate(start), ate: toIsoDate(end) };
}

export function defaultDashboardFilters(): DashboardFilters {
  const range = presetRangeFromDays(DASHBOARD_PERIOD_DEFAULT);
  return {
    ...range,
    esteira: "",
    diretoria: "",
    equipe: "",
    corretor: "",
    roleta: "",
  };
}

export function presetRangeFromDays(days: number) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (Math.max(1, days) - 1));
  return { de: toIsoDate(start), ate: toIsoDate(end) };
}

function parseIsoDate(raw?: string | null) {
  if (!raw || !DATE_PATTERN.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parseDashboardFilters(params: Record<string, string | undefined>): DashboardFilters {
  const defaults = defaultDashboardFilters();
  const de = parseIsoDate(params.de) ?? parseIsoDate(defaults.de)!;
  const ate = parseIsoDate(params.ate) ?? parseIsoDate(defaults.ate)!;

  const start = de <= ate ? de : ate;
  const end = de <= ate ? ate : de;

  return {
    de: toIsoDate(start),
    ate: toIsoDate(end),
    esteira: params.esteira?.trim() ?? "",
    diretoria: params.diretoria?.trim() ?? "",
    equipe: params.equipe?.trim() ?? "",
    corretor: params.corretor?.trim() ?? "",
    roleta: params.roleta?.trim() ?? "",
  };
}

export function dashboardFiltersToSearchParams(filters: DashboardFilters) {
  const params = new URLSearchParams();
  const defaults = defaultDashboardFilters();

  if (filters.de !== defaults.de) params.set("de", filters.de);
  if (filters.ate !== defaults.ate) params.set("ate", filters.ate);
  if (filters.diretoria) params.set("diretoria", filters.diretoria);
  if (filters.equipe) params.set("equipe", filters.equipe);
  if (filters.corretor) params.set("corretor", filters.corretor);
  if (filters.roleta) params.set("roleta", filters.roleta);

  return params;
}

export function countActiveDashboardFilters(filters: DashboardFilters) {
  const defaults = defaultDashboardFilters();
  let count = 0;

  if (filters.de !== defaults.de || filters.ate !== defaults.ate) count += 1;
  if (filters.diretoria) count += 1;
  if (filters.equipe) count += 1;
  if (filters.corretor) count += 1;
  if (filters.roleta) count += 1;

  return count;
}

export function detectQuickPreset(filters: DashboardFilters): DashboardQuickPreset | null {
  for (const preset of ["hoje", "7", "30", "60"] as const) {
    const range = presetRange(preset);
    if (filters.de === range.de && filters.ate === range.ate) return preset;
  }
  return null;
}

export type DashboardActiveChip = {
  key: "periodo" | "diretoria" | "equipe" | "corretor" | "roleta";
  label: string;
};

export function buildDashboardActiveChips(
  filters: DashboardFilters,
  options: DashboardFilterOptions,
): DashboardActiveChip[] {
  const defaults = defaultDashboardFilters();
  const chips: DashboardActiveChip[] = [];

  if (filters.de !== defaults.de || filters.ate !== defaults.ate) {
    const preset = detectQuickPreset(filters);
    const periodLabel = preset === "hoje"
      ? "Hoje"
      : preset === "7"
        ? "7 dias"
        : preset === "30"
          ? "30 dias"
          : preset === "60"
            ? "60 dias"
            : formatDashboardPeriodRange(filters);
    chips.push({ key: "periodo", label: periodLabel });
  }

  if (filters.diretoria) {
    const label = options.diretorias.find((item) => item.id === filters.diretoria)?.label ?? "Diretoria";
    chips.push({ key: "diretoria", label });
  }
  if (filters.equipe) {
    const label = options.equipes.find((item) => item.id === filters.equipe)?.nome ?? "Equipe";
    chips.push({ key: "equipe", label });
  }
  if (filters.corretor) {
    const label = options.corretores.find((item) => item.id === filters.corretor)?.nome ?? "Corretor";
    chips.push({ key: "corretor", label });
  }
  if (filters.roleta) {
    const label = options.roletas.find((item) => item.value === filters.roleta)?.label ?? filters.roleta;
    chips.push({ key: "roleta", label });
  }

  return chips;
}

export function clearDashboardChip(
  filters: DashboardFilters,
  key: DashboardActiveChip["key"],
): DashboardFilters {
  if (key === "periodo") {
    return { ...filters, ...presetRangeFromDays(DASHBOARD_PERIOD_DEFAULT) };
  }
  if (key === "diretoria") {
    return { ...filters, diretoria: "", equipe: "", corretor: "" };
  }
  if (key === "equipe") {
    return { ...filters, equipe: "", corretor: "" };
  }
  if (key === "corretor") {
    return { ...filters, corretor: "" };
  }
  return { ...filters, roleta: "" };
}

export function formatDashboardPeriodRange(filters: Pick<DashboardFilters, "de" | "ate">) {
  const start = parseIsoDate(filters.de);
  const end = parseIsoDate(filters.ate);
  if (!start || !end) return "";

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function dashboardPeriodDays(filters: Pick<DashboardFilters, "de" | "ate">) {
  const start = parseIsoDate(filters.de);
  const end = parseIsoDate(filters.ate);
  if (!start || !end) return DASHBOARD_PERIOD_DEFAULT;

  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diffMs / 86_400_000) + 1);
}

export function labelEsteira(categoryId: string) {
  return ESTEIRA_LABELS[categoryId] ?? `Esteira ${categoryId}`;
}

export function startOfDayIso(isoDate: string) {
  const date = parseIsoDate(isoDate);
  if (!date) return new Date().toISOString();
  return date.toISOString();
}

export function endOfDayIso(isoDate: string) {
  const date = parseIsoDate(isoDate);
  if (!date) return new Date().toISOString();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}
