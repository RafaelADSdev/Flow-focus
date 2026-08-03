"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface FunnelItem {
  status: string;
  label: string;
  total: number;
  gargalo: boolean;
}

interface LeadsFunnelChartProps {
  data: FunnelItem[];
  ariaLabel: string;
}

export function LeadsFunnelChart({ data, ariaLabel }: LeadsFunnelChartProps) {
  if (!data.some((item) => item.total > 0)) {
    return <p className="empty-copy">Nenhum lead entrou no Comercial Geral neste período.</p>;
  }

  const chartHeight = Math.max(280, data.length * 36);
  const labelWidth = Math.min(190, Math.max(130, ...data.map((item) => item.label.length * 7.2)));

  return (
    <div className="chart-wrap chart-wrap-auto" style={{ height: chartHeight }} aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--line)" horizontal={false} strokeDasharray="3 6" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
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
            formatter={(value, _name, item) => {
              const payload = item?.payload as FunnelItem | undefined;
              const suffix = payload?.gargalo ? " · gargalo" : "";
              return [`${Number(value ?? 0).toLocaleString("pt-BR")}${suffix}`, "Leads"];
            }}
          />
          <Bar dataKey="total" name="Leads" radius={[0, 8, 8, 0]} barSize={18}>
            {data.map((entry) => (
              <Cell
                key={entry.status}
                fill={entry.gargalo ? "oklch(0.67 0.14 75)" : "#3C1048"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
