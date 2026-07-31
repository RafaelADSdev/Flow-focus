export function formatUltimaCaptura(value: string | null) {
  if (!value) return "Sem capturas";
  const date = new Date(value);
  const hoje = new Date();
  const mesmoDia = date.toDateString() === hoje.toDateString();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const foiOntem = date.toDateString() === ontem.toDateString();
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (mesmoDia) return `Hoje, ${hora}`;
  if (foiOntem) return `Ontem, ${hora}`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
