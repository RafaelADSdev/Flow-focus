export type ResultadosDateRange = {
  de: string;
  ate: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(raw?: string | null) {
  if (!raw || !DATE_PATTERN.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseResultadosDateRange(params: Record<string, string | undefined>): ResultadosDateRange | null {
  const de = parseIsoDate(params.de);
  const ate = parseIsoDate(params.ate);
  if (!de || !ate) return null;

  const start = de && ate && de > ate ? ate : de ?? ate!;
  const end = de && ate && de > ate ? de : ate ?? de!;

  return { de: toIsoDate(start), ate: toIsoDate(end) };
}

export function isDateInResultadosRange(value: string, range: ResultadosDateRange | null) {
  if (!range) return true;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  const start = parseIsoDate(range.de);
  const end = parseIsoDate(range.ate);
  if (!start || !end) return false;
  end.setHours(23, 59, 59, 999);

  return timestamp >= start.getTime() && timestamp <= end.getTime();
}

export function formatResultadosDateRange(range: ResultadosDateRange | null) {
  if (!range) return "Todo o histórico";

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const format = (value: string) => formatter.format(new Date(`${value}T12:00:00`));
  return `${format(range.de)} – ${format(range.ate)}`;
}
