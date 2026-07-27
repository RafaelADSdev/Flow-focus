"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface LeadsEvolutionChartProps {
  data: Array<{ data: string; recebidos: number; perdidos: number }>;
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatTooltipDay(value: ReactNode) {
  return formatDay(String(value));
}

export function LeadsEvolutionChart({ data }: LeadsEvolutionChartProps) {
  if (!data.length) {
    return <p className="empty-copy">Sem série diária no período.</p>;
  }

  return (
    <div className="chart-wrap" aria-label="Evolução diária de leads recebidos e perdidos">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsRecebidos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3C1A4F" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#3C1A4F" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="leadsPerdidos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B42318" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#B42318" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="data"
            tickFormatter={formatDay}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={formatTooltipDay}
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              boxShadow: "0 4px 8px rgb(28 28 28 / .10)",
              color: "var(--ink)",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="recebidos"
            name="Recebidos"
            stroke="#3C1A4F"
            strokeWidth={2.25}
            fill="url(#leadsRecebidos)"
          />
          <Area
            type="monotone"
            dataKey="perdidos"
            name="Perdidos"
            stroke="#B42318"
            strokeWidth={2.25}
            fill="url(#leadsPerdidos)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
