"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BAR_COLORS = ["#3C1A4F", "#1C1C1C", "#8B5E3C", "#A98DB2", "#62584D", "#2D103E"];

interface LeadsBarChartProps {
  data: Array<{ nome: string; total: number }>;
  ariaLabel: string;
}

export function LeadsBarChart({ data, ariaLabel }: LeadsBarChartProps) {
  if (!data.length) {
    return <p className="empty-copy">Nenhum lead no período para agrupar.</p>;
  }

  const chartHeight = Math.max(220, data.length * 36);

  return (
    <div className="chart-wrap chart-wrap-auto" style={{ height: chartHeight }} aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--line)" horizontal={false} strokeDasharray="3 6" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="nome"
            width={108}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--ink)", fontSize: 12 }}
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
            formatter={(value) => [Number(value ?? 0).toLocaleString("pt-BR"), "Leads"]}
          />
          <Bar dataKey="total" name="Leads" radius={[0, 8, 8, 0]} barSize={18}>
            {data.map((entry, index) => (
              <Cell key={entry.nome} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
