import { Circle } from "lucide-react";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`status status-${tone}`}><Circle size={7} fill="currentColor" aria-hidden="true" />{children}</span>;
}
