"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";

interface ProductivityChartProps {
  data: Array<{ data: string; captadas: number; trabalhadas: number }>;
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatTooltipDay(value: ReactNode) {
  return formatDay(String(value));
}

export function ProductivityChart({ data }: ProductivityChartProps) {
  return <div className="chart-wrap" aria-label="Oportunidades captadas e trabalhadas nos ultimos sete dias"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
    <defs><linearGradient id="captured" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.43 0.15 268.5)" stopOpacity={0.22}/><stop offset="100%" stopColor="oklch(0.43 0.15 268.5)" stopOpacity={0}/></linearGradient></defs>
    <CartesianGrid stroke="oklch(0.91 0.01 268.5)" vertical={false}/><XAxis dataKey="data" tickFormatter={formatDay} axisLine={false} tickLine={false} tick={{ fill: "oklch(0.47 0.025 268.5)", fontSize: 12 }}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "oklch(0.47 0.025 268.5)", fontSize: 12 }}/><Tooltip labelFormatter={formatTooltipDay} contentStyle={{ border: 0, borderRadius: 10, boxShadow: "0 4px 8px oklch(0.2 0.03 268.5 / .12)", fontSize: 13 }} />
    <Area type="monotone" dataKey="captadas" name="Captadas" stroke="oklch(0.43 0.15 268.5)" strokeWidth={2.5} fill="url(#captured)"/><Area type="monotone" dataKey="trabalhadas" name="Trabalhadas" stroke="oklch(0.57 0.13 165)" strokeWidth={2.5} fill="transparent"/>
  </AreaChart></ResponsiveContainer></div>;
}
