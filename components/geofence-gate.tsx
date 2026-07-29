"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  LoaderCircle,
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { isGeofenceProtectedPage } from "@/lib/geofence/routes";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * THESIS: the territorial boundary appears before operational data is exposed.
 * OWN-WORLD: operational ivory, flat surfaces, black navigation and rare semantic color.
 * STORY: the user understands the check, grants GPS and enters; failures explain recovery.
 * FIRST VIEWPORT: authority strip, one central panel and visible privacy note.
 * FORM: local extension of A Central Silenciosa in Operate mode.
 */

type GateStatus =
  | "verificando"
  | "permitido"
  | "bloqueado"
  | "sem_permissao"
  | "sem_suporte"
  | "localizacao_indisponivel"
  | "erro";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ValidationResponse = {
  permitido?: boolean;
  distancia?: number;
  renovarEmMs?: number;
  erro?: string;
};

type GeofenceGateProps = {
  children?: React.ReactNode;
  redirectTo?: Route;
};

const SERVER_VALIDATION_URL = "/api/verificar-localizacao";
const DEFAULT_RENEWAL_MS = 15_000;
const RETRY_INTERVAL_MS = 5_000;

const STATUS_CONTENT: Record<Exclude<GateStatus, "permitido">, {
  label: string;
  title: string;
  description: string;
}> = {
  verificando: {
    label: "Valida\u00e7\u00e3o em andamento",
    title: "Confirmando sua presen\u00e7a no escrit\u00f3rio",
    description: "Autorize a localiza\u00e7\u00e3o precisa no navegador. A opera\u00e7\u00e3o ser\u00e1 liberada assim que o servidor validar o per\u00edmetro.",
  },
  bloqueado: {
    label: "Fora do per\u00edmetro",
    title: "Acesso bloqueado! Para acessar voc\u00ea precisa estar no escrit\u00f3rio.",
    description: "A posi\u00e7\u00e3o informada est\u00e1 fora do raio autorizado. Ao retornar ao escrit\u00f3rio, mantenha esta p\u00e1gina aberta e tente novamente.",
  },
  sem_permissao: {
    label: "Permiss\u00e3o necess\u00e1ria",
    title: "Acesso bloqueado! Para acessar voc\u00ea precisa estar no escrit\u00f3rio.",
    description: "A permiss\u00e3o de localiza\u00e7\u00e3o foi recusada. Libere o acesso nas configura\u00e7\u00f5es do navegador e tente novamente.",
  },
  sem_suporte: {
    label: "Navegador incompat\u00edvel",
    title: "Acesso bloqueado! Para acessar voc\u00ea precisa estar no escrit\u00f3rio.",
    description: "Este navegador n\u00e3o oferece geolocaliza\u00e7\u00e3o. Abra o Flow Focus em um navegador moderno com GPS habilitado.",
  },
  localizacao_indisponivel: {
    label: "Sinal de localiza\u00e7\u00e3o indispon\u00edvel",
    title: "Acesso bloqueado! Para acessar voc\u00ea precisa estar no escrit\u00f3rio.",
    description: "O navegador n\u00e3o conseguiu obter uma posi\u00e7\u00e3o atual. Ative o GPS e os servi\u00e7os de localiza\u00e7\u00e3o, confira a conex\u00e3o e tente novamente.",
  },
  erro: {
    label: "Valida\u00e7\u00e3o indispon\u00edvel",
    title: "Acesso bloqueado! Para acessar voc\u00ea precisa estar no escrit\u00f3rio.",
    description: "N\u00e3o foi poss\u00edvel renovar a valida\u00e7\u00e3o. Confira sua conex\u00e3o e tente novamente; o acesso permanece fechado por seguran\u00e7a.",
  },
};

async function revokeGeoSession() {
  await fetch(SERVER_VALIDATION_URL, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
}

function GateScreen({ status, onRetry }: { status: Exclude<GateStatus, "permitido">; onRetry: () => void }) {
  const content = STATUS_CONTENT[status];
  const isChecking = status === "verificando";
  const canRetry = !isChecking && status !== "sem_suporte";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStatusRef = useRef(status);
  const Icon = status === "sem_suporte"
    ? WifiOff
    : status === "sem_permissao" || status === "erro"
      ? ShieldAlert
      : status === "bloqueado"
        ? MapPin
        : LocateFixed;

  useEffect(() => {
    if (previousStatusRef.current !== status) {
      headingRef.current?.focus();
      previousStatusRef.current = status;
    }
  }, [status]);

  return (
    <main className={`geofence-page geofence-page--${status}`}>
      <header className="geofence-masthead">
        <div className="geofence-brand" aria-label="Flow Focus">
          <span className="geofence-brand-mark" aria-hidden="true">F</span>
          <span><strong>Flow</strong> Focus</span>
        </div>
        <span className="geofence-context">Controle de acesso</span>
      </header>

      <section className="geofence-stage" aria-live={isChecking ? "polite" : "assertive"}>
        <div className="geofence-panel" role={isChecking ? "status" : "alert"} aria-busy={isChecking}>
          <div className="geofence-panel-band" aria-hidden="true" />
          <div className="geofence-panel-content">
            <div className="geofence-state-icon" aria-hidden="true">
              {isChecking ? <LoaderCircle className="spin" size={28} /> : <Icon size={28} />}
            </div>
            <div className="geofence-copy">
              <span className="geofence-status-label"><i aria-hidden="true" />{content.label}</span>
              <h1 ref={headingRef} tabIndex={-1}>{content.title}</h1>
              <p>{content.description}</p>
              {canRetry ? (
                <button className="button button-primary geofence-retry" type="button" onClick={onRetry}>
                  <RefreshCw size={17} aria-hidden="true" />
                  Tentar novamente
                </button>
              ) : null}
            </div>
          </div>
          <div className="geofence-privacy">
            <ShieldAlert size={16} aria-hidden="true" />
            <p>{"Sua posi\u00e7\u00e3o \u00e9 usada somente para validar este acesso. As coordenadas n\u00e3o s\u00e3o armazenadas."}</p>
          </div>
        </div>
      </section>

      <footer className="geofence-footer">
        <span>{"Flow Focus \u00b7 HubOn"}</span>
        <span>{"Geolocaliza\u00e7\u00e3o protegida por sess\u00e3o tempor\u00e1ria"}</span>
      </footer>
    </main>
  );
}

function RedirectingScreen() {
  return (
    <main className="geofence-page geofence-page--permitido" tabIndex={-1}>
      <header className="geofence-masthead">
        <div className="geofence-brand" aria-label="Flow Focus">
          <span className="geofence-brand-mark" aria-hidden="true">F</span>
          <span><strong>Flow</strong> Focus</span>
        </div>
        <span className="geofence-context">Controle de acesso</span>
      </header>
      <section className="geofence-stage" aria-live="polite">
        <div className="geofence-panel geofence-panel--success" role="status">
          <div className="geofence-panel-band" aria-hidden="true" />
          <div className="geofence-panel-content">
            <div className="geofence-state-icon" aria-hidden="true"><CircleCheck size={28} /></div>
            <div className="geofence-copy">
              <span className="geofence-status-label"><i aria-hidden="true" />{"Localiza\u00e7\u00e3o confirmada"}</span>
              <h1>{"Abrindo sua \u00e1rea de trabalho"}</h1>
              <p>{"O per\u00edmetro foi validado pelo servidor. Esta autoriza\u00e7\u00e3o ser\u00e1 renovada enquanto voc\u00ea permanecer no escrit\u00f3rio."}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ActiveGeofenceGate({ children, redirectTo }: GeofenceGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<GateStatus>("verificando");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status === "permitido" && redirectTo) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, status]);

  useEffect(() => {
    if (status !== "permitido") return;

    const frameId = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("main");
      if (!main) return;

      const addedTabIndex = !main.hasAttribute("tabindex");
      if (addedTabIndex) main.tabIndex = -1;
      main.focus();
      if (addedTabIndex) {
        main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [status]);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let nextValidationAt = 0;
    let latestCoordinates: Coordinates | null = null;
    let monitoringBlocked = false;

    if (!("geolocation" in navigator)) {
      const unsupportedTimeoutId = window.setTimeout(() => {
        if (active) setStatus("sem_suporte");
      }, 0);
      void revokeGeoSession();
      return () => {
        active = false;
        window.clearTimeout(unsupportedTimeoutId);
      };
    }

    async function validateLocation(coordinates: Coordinates, force = false) {
      const now = Date.now();
      if (!active || monitoringBlocked || requestInFlight || (!force && now < nextValidationAt)) return;

      requestInFlight = true;
      nextValidationAt = now + RETRY_INTERVAL_MS;

      try {
        const response = await fetch(SERVER_VALIDATION_URL, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coordinates),
        });
        const payload = await response.json().catch(() => ({})) as ValidationResponse;

        if (!response.ok) throw new Error(payload.erro ?? "Falha na valida\u00e7\u00e3o");
        if (!active) return;

        if (payload.permitido) {
          nextValidationAt = Date.now() + (
            typeof payload.renovarEmMs === "number" && payload.renovarEmMs > 0
              ? payload.renovarEmMs
              : DEFAULT_RENEWAL_MS
          );
          setStatus("permitido");
          return;
        }

        nextValidationAt = Date.now() + RETRY_INTERVAL_MS;
        setStatus("bloqueado");
      } catch {
        if (active) setStatus("erro");
      } finally {
        requestInFlight = false;
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latestCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        void validateLocation(latestCoordinates);
      },
      (error) => {
        if (!active) return;

        // Never reuse an old reading after the location provider fails.
        monitoringBlocked = true;
        latestCoordinates = null;
        setStatus(error.code === error.PERMISSION_DENIED ? "sem_permissao" : "localizacao_indisponivel");
        void revokeGeoSession();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 10_000,
      },
    );

    // A heartbeat renews the short session when watchPosition is quiet.
    const heartbeatId = window.setInterval(() => {
      if (latestCoordinates) void validateLocation(latestCoordinates);
    }, 2_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && latestCoordinates) {
        nextValidationAt = 0;
        void validateLocation(latestCoordinates, true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [attempt]);

  if (status === "permitido") {
    return redirectTo ? <RedirectingScreen /> : children;
  }

  return (
    <GateScreen
      status={status}
      onRetry={() => {
        setStatus("verificando");
        setAttempt((value) => value + 1);
      }}
    />
  );
}

export function GeofenceGate(props: GeofenceGateProps) {
  const pathname = usePathname();
  if (!hasSupabaseEnv()) return props.children ?? null;
  if (!props.redirectTo && !isGeofenceProtectedPage(pathname)) return props.children ?? null;
  return <ActiveGeofenceGate {...props} />;
}
