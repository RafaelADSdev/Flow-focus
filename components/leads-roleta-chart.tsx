"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INITIAL_VISIBLE = 8;

interface RoletaItem {
  nome: string;
  ativos: number;
  perdidos: number;
}

interface LeadsRoletaChartProps {
  data: RoletaItem[];
}

export function LeadsRoletaChart({ data }: LeadsRoletaChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (!data.length) {
    return <p className="empty-copy">Nenhuma roleta com volume para exibir.</p>;
  }

  const remaining = Math.max(0, data.length - INITIAL_VISIBLE);
  const visible = expanded ? data : data.slice(0, INITIAL_VISIBLE);
  const chartHeight = Math.max(240, visible.length * 38);

  return (
    <div className="roleta-chart-block">
      <div className="chart-wrap chart-wrap-auto" style={{ height: chartHeight }} aria-label="Leads ativos e perdidos por roleta">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visible} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--line)" horizontal={false} strokeDasharray="3 6" />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="nome"
              width={140}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--ink)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-strong)", opacity: 0.45 }}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                boxShadow: "0 4px 8px rgb(28 28 28 / .10)",
                color: "var(--ink)",
                fontSize: 13,
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "var(--muted)", paddingBottom: 8 }}
            />
            <Bar dataKey="ativos" name="Leads ativos" stackId="a" fill="#3C1048" radius={[0, 0, 0, 0]} barSize={16} />
            <Bar dataKey="perdidos" name="Perdidos" stackId="a" fill="oklch(0.56 0.19 28)" radius={[0, 8, 8, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {remaining > 0 ? (
        <button
          type="button"
          className="button button-quiet roleta-see-more"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ver menos" : `Veja mais (${remaining} restantes)`}
        </button>
      ) : null}
    </div>
  );
}
