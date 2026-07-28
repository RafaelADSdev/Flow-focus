import { RefreshCw } from "lucide-react";

type PageLoadingVariant = "default" | "carteira" | "roletas" | "table";

export function PageLoading({
  label = "Carregando…",
  description,
  variant = "default",
}: {
  label?: string;
  description?: string;
  variant?: PageLoadingVariant;
}) {
  return (
    <div className="page-loading" aria-busy="true" aria-live="polite" aria-label={label}>
      <div className="page-loading-head">
        <RefreshCw className="is-spinning" size={22} aria-hidden="true" />
        <strong>{label}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {variant === "default" ? (
        <div className="page-loading-skeletons">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton skeleton-panel" />
        </div>
      ) : null}
      {variant === "carteira" ? (
        <div className="page-loading-skeletons">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton skeleton-panel broker-overview-skeleton" />
          <div className="skeleton skeleton-grid roulette-grid-skeleton" />
        </div>
      ) : null}
      {variant === "roletas" ? (
        <div className="page-loading-skeletons">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton skeleton-toolbar" />
          <div className="skeleton skeleton-panel permission-table-skeleton" />
        </div>
      ) : null}
      {variant === "table" ? (
        <div className="page-loading-skeletons">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton skeleton-toolbar" />
          <div className="skeleton skeleton-panel" />
        </div>
      ) : null}
    </div>
  );
}
