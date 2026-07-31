export const MAX_ACTIVE_LEADS = 6;

export function availableCaptureSlots(activeLeads: number, limit = MAX_ACTIVE_LEADS) {
  if (!Number.isFinite(activeLeads) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.trunc(limit) - Math.max(0, Math.trunc(activeLeads)));
}
