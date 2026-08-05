import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatResultadosDateRange, type ResultadosDateRange } from "@/lib/resultados-filters";

export function ResultadosDateFilter({ range }: { range: ResultadosDateRange | null }) {
  return (
    <div className="results-date-filter-wrap">
      <div className="results-date-filter-heading">
        <span className="results-date-filter-label">Período dos resultados</span>
        <span className="results-date-filter-current">{formatResultadosDateRange(range)}</span>
      </div>
      <form className="results-date-filter" action="/resultados" method="get" aria-label="Filtrar resultados por período">
        <label className="results-date-field">
          <span>De</span>
          <span className="results-date-input">
            <input
              type="date"
              name="de"
              defaultValue={range?.de ?? ""}
              max={range?.ate}
              required
              aria-label="Data inicial"
            />
            <CalendarDays size={15} aria-hidden="true" />
          </span>
        </label>
        <label className="results-date-field">
          <span>Até</span>
          <span className="results-date-input">
            <input
              type="date"
              name="ate"
              defaultValue={range?.ate ?? ""}
              min={range?.de}
              required
              aria-label="Data final"
            />
            <CalendarDays size={15} aria-hidden="true" />
          </span>
        </label>
        <div className="results-date-actions">
          <button type="submit" className="button button-primary">Aplicar</button>
          {range ? <Link className="button button-quiet" href="/resultados">Limpar</Link> : null}
        </div>
      </form>
    </div>
  );
}
