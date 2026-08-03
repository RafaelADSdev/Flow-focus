const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeBitrixStageColor(value: unknown) {
  const color = String(value ?? "").trim();
  return HEX_COLOR.test(color) ? color.toUpperCase() : null;
}
