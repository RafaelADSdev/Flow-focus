import { sameRoletaIds } from "./permissions";

export type RoletaSaveErrorCode = "conflict" | "validation" | "partial";

type RoletaAssignmentSnapshot = {
  roletaIds: string[];
  roletaIdsAntes: string[];
};

type DraftSummaryInput = {
  brokerIds: string[];
  roletaIds: string[];
  baseline: Record<string, string[]>;
  selected: Record<string, string[]>;
};

export function getUnavailableRoletaFailure(
  assignments: RoletaAssignmentSnapshot[],
  manageableIds: ReadonlySet<string>,
) {
  const hasUnavailableId = assignments.some(({ roletaIds, roletaIdsAntes }) =>
    [...roletaIds, ...roletaIdsAntes].some((id) => !manageableIds.has(id)),
  );

  if (!hasUnavailableId) return null;

  return {
    ok: false as const,
    code: "conflict" as const,
    error: "Uma das roletas mudou ou deixou de estar disponível. Atualize os dados antes de salvar.",
  };
}

export function isRoletaRefreshRequired(code: string): code is Extract<RoletaSaveErrorCode, "conflict" | "partial"> {
  return code === "conflict" || code === "partial";
}

export function summarizeRoletaDraft({ brokerIds, roletaIds, baseline, selected }: DraftSummaryInput) {
  let cellChanges = 0;
  const dirtyBrokerIds = new Set<string>();

  for (const brokerId of brokerIds) {
    const current = selected[brokerId] ?? [];
    const original = baseline[brokerId] ?? [];
    if (sameRoletaIds(current, original)) continue;

    dirtyBrokerIds.add(brokerId);
    const currentSet = new Set(current);
    const originalSet = new Set(original);
    for (const roletaId of roletaIds) {
      if (currentSet.has(roletaId) !== originalSet.has(roletaId)) cellChanges += 1;
    }
  }

  return {
    cellChanges,
    brokersChanged: dirtyBrokerIds.size,
    dirty: cellChanges > 0,
    dirtyBrokerIds,
  };
}
