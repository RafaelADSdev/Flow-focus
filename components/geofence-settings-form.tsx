"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LocateFixed,
  MapPin,
  RefreshCw,
  Ruler,
  Save,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { salvarConfiguracaoGeofence } from "@/lib/actions/geofence-settings";
import type { GeofenceSettingsData } from "@/lib/types/geofence-settings";

/**
 * THESIS: configure the boundary as one accountable operational decision, not a map editor.
 * OWN-WORLD: ivory work surface, one dark perimeter instrument and restrained purple actions.
 * STORY: the admin sees the active source, captures or enters a point, sets the radius and saves.
 * FIRST VIEWPORT: editable coordinates on the left; a live perimeter readout and provenance on the right.
 * FORM: an Operate-mode extension of A Central Silenciosa, shaped directly for the existing settings world.
 */

type GeofenceSettingsFormProps = {
  initialData: GeofenceSettingsData;
};

function inputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function sourceLabel(source: GeofenceSettingsData["source"]) {
  if (source === "database") return "Per\u00edmetro salvo";
  if (source === "environment") return "Vari\u00e1veis de ambiente";
  return "Ainda n\u00e3o configurado";
}

export function GeofenceSettingsForm({ initialData }: GeofenceSettingsFormProps) {
  const router = useRouter();
  const [latitude, setLatitude] = useState(inputValue(initialData.latitude));
  const [longitude, setLongitude] = useState(inputValue(initialData.longitude));
  const [radiusMeters, setRadiusMeters] = useState(String(initialData.radiusMeters));
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const radiusPreview = Number(radiusMeters);
  const latitudePreview = latitude.trim() === "" ? null : Number(latitude);
  const longitudePreview = longitude.trim() === "" ? null : Number(longitude);
  const hasCompleteCoordinates = latitudePreview !== null
    && Number.isFinite(latitudePreview)
    && longitudePreview !== null
    && Number.isFinite(longitudePreview);
  const dirty = latitudePreview !== initialData.latitude
    || longitudePreview !== initialData.longitude
    || radiusPreview !== initialData.radiusMeters;
  const needsPersistence = initialData.source !== "database";
  const canSubmit = initialData.canSave
    && hasCompleteCoordinates
    && Number.isFinite(radiusPreview)
    && (dirty || needsPersistence);
  const displayedRadius = Number.isFinite(radiusPreview) && radiusPreview > 0
    ? Math.round(radiusPreview)
    : 0;
  const updatedAt = formatUpdatedAt(initialData.updatedAt);

  function updateField(setter: (value: string) => void, value: string) {
    setter(value);
    setFeedback(null);
  }

  function useCurrentLocation() {
    setFeedback(null);

    if (!("geolocation" in navigator)) {
      setFeedback({
        kind: "error",
        message: "Este navegador n\u00e3o oferece geolocaliza\u00e7\u00e3o. Digite as coordenadas manualmente.",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setAccuracyMeters(Math.round(position.coords.accuracy));
        setLocating(false);
        setFeedback({
          kind: "success",
          message: "Posi\u00e7\u00e3o capturada. Confira o raio e salve para ativar o novo per\u00edmetro.",
        });
      },
      (error) => {
        setLocating(false);
        const message = error.code === error.PERMISSION_DENIED
          ? "A permiss\u00e3o de localiza\u00e7\u00e3o foi recusada. Libere o GPS ou digite as coordenadas."
          : "N\u00e3o foi poss\u00edvel obter a posi\u00e7\u00e3o. Confira o GPS e tente novamente.";
        setFeedback({ kind: "error", message });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await salvarConfiguracaoGeofence({
          latitude,
          longitude,
          radiusMeters,
        });

        if (!result.ok) {
          setFeedback({ kind: "error", message: result.error });
          return;
        }

        setFeedback({
          kind: "success",
          message: "Per\u00edmetro salvo. Os acessos ser\u00e3o revalidados com a nova localiza\u00e7\u00e3o.",
        });
        router.refresh();
      } catch {
        setFeedback({
          kind: "error",
          message: "A comunica\u00e7\u00e3o com o servidor falhou. Recarregue a p\u00e1gina e tente novamente.",
        });
      }
    });
  }

  return (
    <div className="geo-settings-layout">
      <form className="geo-settings-form" onSubmit={submit}>
        <div className="geo-settings-section-head">
          <div>
            <span className="geo-settings-kicker">Ponto central</span>
            <h2>{"Onde fica o escrit\u00f3rio?"}</h2>
            <p>{"Capture a posi\u00e7\u00e3o neste dispositivo ou informe as coordenadas manualmente."}</p>
          </div>
          <button
            className="button button-secondary geo-settings-locate"
            type="button"
            onClick={useCurrentLocation}
            disabled={pending || locating}
          >
            <LocateFixed className={locating ? "spin" : undefined} size={17} aria-hidden="true" />
            {locating ? "Capturando..." : "Usar minha localiza\u00e7\u00e3o atual"}
          </button>
        </div>

        <div className="geo-settings-coordinate-grid">
          <label className="geo-settings-field">
            <span>Latitude</span>
            <input
              name="latitude"
              type="number"
              inputMode="decimal"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(event) => updateField(setLatitude, event.target.value)}
              placeholder="-8.283300"
              required
            />
            <small>Entre -90 e 90</small>
          </label>
          <label className="geo-settings-field">
            <span>Longitude</span>
            <input
              name="longitude"
              type="number"
              inputMode="decimal"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(event) => updateField(setLongitude, event.target.value)}
              placeholder="-34.950000"
              required
            />
            <small>Entre -180 e 180</small>
          </label>
        </div>

        {accuracyMeters !== null ? (
          <p className="geo-settings-accuracy">
            <LocateFixed size={15} aria-hidden="true" />
            {`Precis\u00e3o informada pelo dispositivo: aproximadamente ${accuracyMeters} m.`}
          </p>
        ) : null}

        <div className="geo-settings-radius-row">
          <label className="geo-settings-field">
            <span>{"Raio permitido"}</span>
            <span className="geo-settings-radius-input">
              <Ruler size={17} aria-hidden="true" />
              <input
                name="radiusMeters"
                type="number"
                inputMode="numeric"
                min="10"
                max="5000"
                step="1"
                value={radiusMeters}
                onChange={(event) => updateField(setRadiusMeters, event.target.value)}
                required
              />
              <em>metros</em>
            </span>
            <small>De 10 a 5.000 metros</small>
          </label>
          <p>{"Quem estiver al\u00e9m deste raio perde o acesso quando a geo-sess\u00e3o curta expirar."}</p>
        </div>

        {initialData.loadError ? (
          <div className="geo-settings-notice geo-settings-notice--warning" role="status">
            <TriangleAlert size={18} aria-hidden="true" />
            <p>{initialData.loadError}</p>
            {!initialData.canSave ? (
              <button className="button button-quiet" type="button" onClick={() => router.refresh()}>
                <RefreshCw size={15} aria-hidden="true" />
                Recarregar
              </button>
            ) : null}
          </div>
        ) : null}

        {feedback ? (
          <div
            className={`geo-settings-notice geo-settings-notice--${feedback.kind}`}
            role={feedback.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.kind === "success"
              ? <CheckCircle2 size={18} aria-hidden="true" />
              : <TriangleAlert size={18} aria-hidden="true" />}
            <p>{feedback.message}</p>
          </div>
        ) : null}

        <div className="geo-settings-actions">
          <div>
            <ShieldCheck size={17} aria-hidden="true" />
            <p>{"Somente administradores podem alterar este per\u00edmetro. Cada altera\u00e7\u00e3o fica registrada."}</p>
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={pending || locating || !canSubmit}
          >
            <Save size={17} aria-hidden="true" />
            {pending
              ? "Salvando..."
              : needsPersistence && !dirty
                ? "Salvar no banco"
                : "Salvar per\u00edmetro"}
          </button>
        </div>
      </form>

      <aside className="geo-settings-summary" aria-label={"Resumo do per\u00edmetro"}>
        <div className="geo-settings-summary-head">
          <span className={`status-badge ${!dirty && initialData.source === "database" ? "status-success" : "status-warning"}`}>
            <i aria-hidden="true" />
            {dirty ? "Pr\u00e9via n\u00e3o salva" : sourceLabel(initialData.source)}
          </span>
          <span>{dirty ? "Pr\u00e9via do per\u00edmetro" : "Per\u00edmetro ativo"}</span>
        </div>

        <div className="geo-settings-radar" aria-hidden="true">
          <span className="geo-settings-ring geo-settings-ring--outer" />
          <span className="geo-settings-ring geo-settings-ring--inner" />
          <span className="geo-settings-radar-pin"><MapPin size={24} /></span>
        </div>

        <div className="geo-settings-radius-readout">
          <span>Raio de acesso</span>
          <strong>{displayedRadius.toLocaleString("pt-BR")}<small>m</small></strong>
        </div>

        <dl className="geo-settings-coordinates">
          <div>
            <dt>Latitude</dt>
            <dd>{latitude || "\u2014"}</dd>
          </div>
          <div>
            <dt>Longitude</dt>
            <dd>{longitude || "\u2014"}</dd>
          </div>
        </dl>

        <div className="geo-settings-provenance">
          <ShieldCheck size={17} aria-hidden="true" />
          <div>
            <strong>{initialData.source === "database"
              ? initialData.updatedBy ?? "Autor indispon\u00edvel"
              : "Configura\u00e7\u00e3o inicial"}</strong>
            <span>{updatedAt ? `Atualizado em ${updatedAt}` : "Ainda n\u00e3o salvo no banco"}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
