import Image from "next/image";

type PartnerBrandLockupProps = {
  /** Fundo claro (login) ou escuro (sidebar). */
  tone?: "on-light" | "on-dark";
  compact?: boolean;
  className?: string;
};

const FLOW = {
  "on-light": "/brand/logo-claro-v2.png?v=3",
  "on-dark": "/brand/logo-escuro.png",
} as const;

const HUBON = {
  /** Login: HubOn colorida. */
  "on-light": "/brand/hubon-cor.png",
  /** Sistema (sidebar): HubOn branco sem fundo. */
  "on-dark": "/brand/hubon-branco.png",
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
      aria-label="HubOn e Flow Focus"
    >
      {!compact ? (
        <>
          <Image
            src={hubonSrc}
            alt="HubOn"
            width={168}
            height={56}
            className="partner-brand-hubon"
            priority
            unoptimized
          />
          <span className="partner-brand-divider" aria-hidden="true" />
        </>
      ) : null}
      <Image
        src={flowSrc}
        alt="Flow Focus"
        width={compact ? 96 : 200}
        height={compact ? 54 : 112}
        className="partner-brand-flow"
        priority
        unoptimized
      />
    </div>
  );
}
