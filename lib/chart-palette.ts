/**
 * Paleta do gráfico de capturas por equipe — alinhada a docs/design.md:
 * roxo Focus (volume), lavanda (pipeline), negativo (perdidos), alerta bronze (quarentena).
 */
export const RESULTADOS_EQUIPE_CHART_SERIES = [
  { key: "total", label: "Captados", color: "var(--chart-captados)" },
  { key: "andamento", label: "Em andamento", color: "var(--chart-andamento)" },
  { key: "perdidos", label: "Negócios perdidos", color: "var(--chart-perdidos)" },
  { key: "quarentena", label: "Quarentena", color: "var(--chart-quarentena)" },
] as const;

/** Valores resolvidos para Recharts (não lê CSS vars em SVG). */
export const RESULTADOS_EQUIPE_CHART_COLORS = {
  captados: "#3C1048",
  andamento: "oklch(0.58 0.11 292)",
  perdidos: "oklch(0.56 0.19 28)",
  quarentena: "oklch(0.66 0.17 65)",
} as const;

export const RESULTADOS_EQUIPE_CHART_SERIES_RESOLVED = [
  { key: "total", label: "Captados", color: RESULTADOS_EQUIPE_CHART_COLORS.captados },
  { key: "andamento", label: "Andamento", color: RESULTADOS_EQUIPE_CHART_COLORS.andamento },
  { key: "perdidos", label: "Perdidos", color: RESULTADOS_EQUIPE_CHART_COLORS.perdidos },
  { key: "quarentena", label: "Quarentena", color: RESULTADOS_EQUIPE_CHART_COLORS.quarentena },
] as const;
