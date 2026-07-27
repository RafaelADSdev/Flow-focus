import Image from "next/image";

type PartnerBrandLockupProps = {
  /** Fundo claro (login) ou escuro (sidebar). */
  tone?: "on-light" | "on-dark";
  compact?: boolean;
  className?: string;
};

const FLOW = {
  "on-light": "/brand/logo-claro.png?v=4",
  "on-dark": "/brand/logo-escuro.png?v=4",
} as const;

const HUBON = {
  /** Login: HubOn colorida. */
  "on-light": "/brand/hubon-cor.png?v=5",
  /** Sistema (sidebar): HubOn branco sem fundo. */
  "on-dark": "/brand/hubon-branco.png?v=6",
} as const;

export function PartnerBrandLockup({
  tone = "on-light",
  compact = false,
  className = "",
}: PartnerBrandLockupProps) {
  const flowSrc = FLOW[tone];
  const hubonSrc = HUBON[tone];

  return (
    <div
      className={`partner-brand-lockup${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      aria-label="Flow Focus e HubOn"
    >
      <Image
        src={flowSrc}
        alt="Flow Focus"
        width={compact ? 96 : 200}
        height={compact ? 54 : 112}
        className="partner-brand-flow"
        priority
        unoptimized
      />
      {!compact ? (
        <>
          <span className="partner-brand-divider" aria-hidden="true" />
          <Image
            src={hubonSrc}
            alt="HubOn"
            width={168}
            height={56}
            className="partner-brand-hubon"
            priority
            unoptimized
          />
        </>
      ) : null}
    </div>
  );
}
