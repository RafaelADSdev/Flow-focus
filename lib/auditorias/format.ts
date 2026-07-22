export function formatEspera(minutos: number) {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${String(resto).padStart(2, "0")}min` : `${horas}h`;
}

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

export function formatTempoMedio(horas: number) {
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}
