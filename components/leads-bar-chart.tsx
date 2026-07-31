"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BAR_COLORS = ["#3C1A4F", "#1C1C1C", "#8B5E3C", "#A98DB2", "#62584D", "#2D103E"];

type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

interface LeadsBarChartProps {
  data: Array<{ nome: string; total?: number; [key: string]: string | number | undefined }>;
  ariaLabel: string;
  valueLabel?: string;
  series?: ChartSeries[];
}

export function LeadsBarChart({ data, ariaLabel, valueLabel = "Leads", series }: LeadsBarChartProps) {
  const hasValues = series
    ? data.some((item) => series.some(({ key }) => Number(item[key] ?? 0) > 0))
    : data.some((item) => Number(item.total ?? 0) > 0);

  if (!data.length || !hasValues) {
    return <p className="empty-copy">Nenhum lead no período para agrupar.</p>;
  }

  const chartHeight = Math.max(220, data.length * (series ? 44 : 36));

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
            formatter={(value, name) => [Number(value ?? 0).toLocaleString("pt-BR"), String(name)]}
          />
          {series ? (
            <>
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: "var(--muted)", paddingBottom: 8 }}
              />
              {series.map(({ key, label, color }, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={label}
                  fill={color}
                  radius={index === series.length - 1 ? [0, 8, 8, 0] : [0, 0, 0, 0]}
                  barSize={14}
                />
              ))}
            </>
          ) : (
            <Bar dataKey="total" name={valueLabel} radius={[0, 8, 8, 0]} barSize={18}>
              {data.map((entry, index) => (
                <Cell key={entry.nome} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
