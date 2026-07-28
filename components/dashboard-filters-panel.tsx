"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  buildDashboardActiveChips,
  clearDashboardChip,
  countActiveDashboardFilters,
  dashboardFiltersToSearchParams,
  defaultDashboardFilters,
  detectQuickPreset,
  formatDashboardPeriodRange,
  presetRange,
  type DashboardActiveChip,
  type DashboardFilterOptions,
  type DashboardFilters,
  type DashboardQuickPreset,
} from "@/lib/dashboard-filters";

type DashboardFiltersPanelProps = {
  filters: DashboardFilters;
  options: DashboardFilterOptions;
  basePath?: Route;
};

function FilterField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="dashboard-filter-field">
      <span className="dashboard-filter-label">{label}</span>
      <label className="dashboard-filter-select">
        <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
          {children.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function DashboardFiltersPanel({ filters, options, basePath = "/dashboard" }: DashboardFiltersPanelProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const activeCount = countActiveDashboardFilters(filters);
  const activeChips = useMemo(
    () => buildDashboardActiveChips(filters, options),
    [filters, options],
  );

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("[data-filter-close]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  const quickPreset = detectQuickPreset(draft);

  const equipeOptions = useMemo(() => {
    const base = [{ value: "", label: "Todas" }];
    const list = options.equipes.filter((equipe) =>
      !draft.diretoria || equipe.diretoriaId === draft.diretoria,
    );
    return base.concat(list.map((equipe) => ({ value: equipe.id, label: equipe.nome })));
  }, [draft.diretoria, options.equipes]);

  const corretorOptions = useMemo(() => {
    const base = [{ value: "", label: "Todos" }];
    const list = options.corretores.filter((corretor) =>
      !draft.equipe || corretor.equipeId === draft.equipe,
    );
    return base.concat(list.map((corretor) => ({ value: corretor.id, label: corretor.nome })));
  }, [draft.equipe, options.corretores]);

  const roletaOptions = useMemo(() => {
    const base = [{ value: "", label: "Todas" }];
    return base.concat(options.roletas.map((roleta) => ({
      value: roleta.value,
      label: roleta.label,
    })));
  }, [options.roletas]);

  function updateDraft(partial: Partial<DashboardFilters>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function applyQuickPreset(preset: DashboardQuickPreset) {
    updateDraft(presetRange(preset));
  }

  function applyFilters(next: DashboardFilters) {
    const params = dashboardFiltersToSearchParams(next);
    const query = params.toString();
    router.push((query ? `${basePath}?${query}` : basePath) as Route);
    setOpen(false);
  }

  function clearFilters() {
    setDraft(defaultDashboardFilters());
  }

  function handleApply() {
    let next = { ...draft };

    if (next.equipe && !equipeOptions.some((option) => option.value === next.equipe)) {
      next = { ...next, equipe: "" };
    }
    if (next.corretor && !corretorOptions.some((option) => option.value === next.corretor)) {
      next = { ...next, corretor: "" };
    }
    if (next.roleta && !roletaOptions.some((option) => option.value === next.roleta)) {
      next = { ...next, roleta: "" };
    }

    applyFilters(next);
  }

  function removeChip(key: DashboardActiveChip["key"]) {
    applyFilters(clearDashboardChip(filters, key));
  }

  return (
    <>
      <div className="overview-period-filter-wrap">
        <button
          type="button"
          className="button button-quiet overview-filters-trigger"
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtros
          {activeCount > 0 ? <span className="overview-filters-badge">{activeCount}</span> : null}
        </button>
        <p className="overview-period-range" aria-live="polite">
          {formatDashboardPeriodRange(filters)}
        </p>
        {activeChips.length ? (
          <ul className="overview-filter-chips" aria-label="Filtros ativos">
            {activeChips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  className="overview-filter-chip"
                  onClick={() => removeChip(chip.key)}
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {open ? (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <aside
            ref={drawerRef}
            className="audit-drawer dashboard-filters-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-filters-title"
          >
            <header className="dashboard-filters-header">
              <div className="dashboard-filters-title">
                <SlidersHorizontal size={18} aria-hidden="true" />
                <h2 id="dashboard-filters-title">Filtros</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                data-filter-close
                onClick={() => setOpen(false)}
                aria-label="Fechar filtros"
              >
                <X size={20} />
              </button>
            </header>

            <div className="drawer-content dashboard-filters-content">
              <div className="dashboard-filter-presets" role="group" aria-label="Atalhos de período">
                {([
                  ["hoje", "Hoje"],
                  ["7", "7 dias"],
                  ["30", "30 dias"],
                  ["60", "60 dias"],
                ] as const).map(([preset, label]) => (
                  <button
                    key={preset}
                    type="button"
                    className={quickPreset === preset ? "dashboard-filter-pill is-active" : "dashboard-filter-pill"}
                    onClick={() => applyQuickPreset(preset)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="dashboard-filter-dates">
                <label className="dashboard-filter-date">
                  <span className="dashboard-filter-label">De</span>
                  <span className="dashboard-filter-date-input">
                    <input
                      type="date"
                      value={draft.de}
                      max={draft.ate}
                      onChange={(event) => updateDraft({ de: event.target.value })}
                      aria-label="Data inicial"
                    />
                    <CalendarDays size={16} aria-hidden="true" />
                  </span>
                </label>
                <label className="dashboard-filter-date">
                  <span className="dashboard-filter-label">Até</span>
                  <span className="dashboard-filter-date-input">
                    <input
                      type="date"
                      value={draft.ate}
                      min={draft.de}
                      onChange={(event) => updateDraft({ ate: event.target.value })}
                      aria-label="Data final"
                    />
                    <CalendarDays size={16} aria-hidden="true" />
                  </span>
                </label>
              </div>

              <div className="dashboard-filter-field">
                <span className="dashboard-filter-label">Esteira</span>
                <div className="dashboard-filter-static" aria-label="Esteira">
                  {options.esteiras[0]?.label ?? "Comercial Geral"}
                </div>
              </div>

              <FilterField
                label="Diretoria"
                value={draft.diretoria}
                onChange={(diretoria) => updateDraft({ diretoria, equipe: "", corretor: "" })}
              >
                {[{ value: "", label: "Todas" }, ...options.diretorias.map((item) => ({
                  value: item.id,
                  label: item.label,
                }))]}
              </FilterField>

              <FilterField
                label="Equipe"
                value={draft.equipe}
                onChange={(equipe) => updateDraft({ equipe, corretor: "" })}
              >
                {equipeOptions}
              </FilterField>

              <FilterField
                label="Corretor"
                value={draft.corretor}
                onChange={(corretor) => updateDraft({ corretor })}
              >
                {corretorOptions}
              </FilterField>

              <FilterField
                label="Roleta"
                value={draft.roleta}
                onChange={(roleta) => updateDraft({ roleta })}
              >
                {roletaOptions}
              </FilterField>
            </div>

            <footer className="dashboard-filters-footer">
              <button type="button" className="button button-quiet dashboard-filters-clear" onClick={clearFilters}>
                <RotateCcw size={16} aria-hidden="true" />
                Limpar filtros
              </button>
              <button
                type="button"
                className="button button-primary dashboard-filters-apply"
                onClick={handleApply}
              >
                <Check size={16} aria-hidden="true" />
                Aplicar filtros
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
