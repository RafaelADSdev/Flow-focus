"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BAR_COLORS = ["#3C1048", "#1C1C1C", "#8B5E3C", "#A98DB2", "#62584D", "#2D0C36"];

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
  orientation?: "horizontal" | "vertical";
  keepEmptyCategories?: boolean;
  compactGroups?: boolean;
  fillContainer?: boolean;
  hideLegend?: boolean;
}

function formatBarLabel(value: unknown) {
  const numeric = Number(value ?? 0);
  return numeric > 0 ? numeric.toLocaleString("pt-BR") : "";
}

export function LeadsBarChart({
  data,
  ariaLabel,
  valueLabel = "Leads",
  series,
  orientation = "horizontal",
  keepEmptyCategories = false,
  compactGroups = false,
  fillContainer = false,
  hideLegend = false,
}: LeadsBarChartProps) {
  const visibleData = series && !keepEmptyCategories
    ? data.filter((item) => Number(item.total ?? 0) > 0)
    : data;

  const hasValues = series
    ? visibleData.some((item) => series.some(({ key }) => Number(item[key] ?? 0) > 0))
    : visibleData.some((item) => Number(item.total ?? 0) > 0);

  if (!visibleData.length || !hasValues) {
    return <p className="empty-copy">Nenhum lead no período para agrupar.</p>;
  }

  const isVertical = orientation === "vertical";
  const chartHeight = fillContainer
    ? undefined
    : isVertical
      ? Math.max(240, visibleData.length * (compactGroups ? 56 : 72))
      : Math.max(220, visibleData.length * (series ? 44 : 36));

  const verticalMargin = series
    ? { top: hideLegend ? 8 : 28, right: fillContainer ? 12 : compactGroups ? 4 : 8, left: fillContainer ? 4 : compactGroups ? 4 : 0, bottom: 22 }
    : { top: 4, right: 8, left: 0, bottom: 14 };

  const compactWidth = compactGroups && isVertical && !fillContainer
    ? Math.min(520, Math.max(300, visibleData.length * 108 + 72))
    : undefined;

  const barCategoryGap = series && isVertical
    ? (fillContainer ? "22%" : compactGroups ? 6 : "18%")
    : undefined;

  const barSize = series && isVertical && fillContainer ? 16 : series && isVertical ? 14 : undefined;

  return (
    <div
      className={[
        "chart-wrap",
        fillContainer ? "chart-wrap-fill" : "chart-wrap-auto",
        compactGroups && !fillContainer ? "chart-wrap-compact-groups" : "",
      ].filter(Boolean).join(" ")}
      style={fillContainer ? undefined : { height: chartHeight, maxWidth: compactWidth }}
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={visibleData}
          layout={isVertical ? "horizontal" : "vertical"}
          margin={isVertical ? verticalMargin : { top: 4, right: 16, left: 4, bottom: 4 }}
          barGap={series && isVertical ? 3 : undefined}
          barCategoryGap={barCategoryGap}
        >
          <CartesianGrid
            stroke="var(--line)"
            horizontal={isVertical}
            vertical={!isVertical}
            strokeDasharray="3 6"
          />
          {isVertical ? (
            <>
              <XAxis
                type="category"
                dataKey="nome"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                interval={0}
                tick={{ fill: "var(--ink)", fontSize: 10 }}
              />
              <YAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={34}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="nome"
                width={108}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--ink)", fontSize: 12 }}
              />
            </>
          )}
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
              {!hideLegend ? (
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, color: "var(--muted)", paddingBottom: 12 }}
                />
              ) : null}
              {series.map(({ key, label, color }, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={label}
                  fill={color}
                  radius={isVertical ? [8, 8, 0, 0] : index === series.length - 1 ? [0, 8, 8, 0] : [0, 0, 0, 0]}
                  barSize={barSize}
                >
                  {isVertical ? (
                    <LabelList
                      dataKey={key}
                      position="top"
                      formatter={formatBarLabel}
                      fill="var(--ink)"
                      fontSize={10}
                    />
                  ) : null}
                </Bar>
              ))}
            </>
          ) : (
            <Bar dataKey="total" name={valueLabel} radius={isVertical ? [8, 8, 0, 0] : [0, 8, 8, 0]} barSize={18}>
              {visibleData.map((entry, index) => (
                <Cell key={entry.nome} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
