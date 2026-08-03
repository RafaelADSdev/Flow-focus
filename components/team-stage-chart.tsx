"use client";

import type { CSSProperties } from "react";
import { stageBarColor } from "@/lib/team/stage-colors";

export function isLostStageName(name: string) {
  return /perdid|prazo/i.test(name);
}

function stageAriaLabel(name: string, count: number, critical: number) {
  return `${name}: ${count} ${count === 1 ? "negócio" : "negócios"}${critical ? `, ${critical} ${critical === 1 ? "crítico" : "críticos"}` : ""}`;
}

function compactStageLabel(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("tentativa")) return "Tentativa";
  if (normalized.includes("novo")) return "Novos";
  if (normalized.includes("agendad")) return "Agendados";
  if (normalized.includes("realizad")) return "Realizados";
  if (normalized.includes("atendimento")) return "Atend.";
  if (normalized.includes("proposta")) return "Propostas";
  if (normalized.includes("rodad")) return "Rodados";
  if (normalized.includes("assinad")) return "Assinados";
  if (normalized.includes("prazo") && normalized.includes("perdid")) return "Prazos";
  if (normalized.includes("perdid")) return "Perdidos";
  return name.length > 11 ? `${name.slice(0, 10)}…` : name;
}

export function TeamStageChart({
  stages,
  criticalById,
  compact = false,
}: {
  stages: Array<{ id: string; name: string; count: number; color?: string | null }>;
  criticalById?: Record<string, number>;
  compact?: boolean;
}) {
  const maximum = Math.max(1, ...stages.map((stage) => stage.count));
  const summary = stages.map((stage) => {
    const critical = criticalById?.[stage.id] ?? 0;
    return stageAriaLabel(stage.name, stage.count, critical);
  }).join("; ");

  return (
    <div
      className={compact ? "team-stage-chart is-compact" : "team-stage-chart"}
      role="img"
      aria-label={summary || "Distribuição por etapa"}
    >
      {stages.map((stage, index) => {
        const critical = criticalById?.[stage.id] ?? 0;
        const hasCritical = critical > 0;
        const barColor = stage.color ?? stageBarColor(stage.name, index);
        const style = {
          "--stage-size": `${Math.max(stage.count ? 5 : 1, Math.round((stage.count / maximum) * 100))}%`,
          "--stage-bar": barColor,
        } as CSSProperties;
        const label = compact ? compactStageLabel(stage.name) : stage.name;
        return (
          <div
            className={`team-stage-column${hasCritical ? " has-critical" : ""}`}
            key={stage.id}
            title={stageAriaLabel(stage.name, stage.count, critical)}
            aria-hidden="true"
            style={style}
          >
            <span className="team-stage-number" aria-hidden="true">{stage.count}</span>
            <span className="team-stage-track" aria-hidden="true"><i /></span>
            <span className="team-stage-label" aria-hidden="true">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
