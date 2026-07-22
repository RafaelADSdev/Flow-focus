import Image from "next/image";

type BrandMarkProps = {
  compact?: boolean;
  /** Logo para fundos escuros (marca clara). Logo para fundos claros (marca escura). */
  variant?: "on-dark" | "on-light";
  className?: string;
};

const sources = {
  "on-dark": "/brand/logo-escuro.png",
  "on-light": "/brand/logo-claro.png",
} as const;

export function BrandMark({ compact = false, variant = "on-dark", className = "" }: BrandMarkProps) {
  const toneClass = variant === "on-dark" ? "brand-logo-on-dark" : "brand-logo-on-light";

  return (
    <div className={`brand${compact ? " brand-compact" : ""}${className ? ` ${className}` : ""}`} aria-label="Flow Focus">
      <Image
        src={sources[variant]}
        alt=""
        width={compact ? 62 : variant === "on-light" ? 104 : 72}
        height={compact ? 34 : variant === "on-light" ? 58 : 38}
        className={`brand-logo ${toneClass}`}
        style={{ width: "auto", height: "auto" }}
        priority
      />
    </div>
  );
}
