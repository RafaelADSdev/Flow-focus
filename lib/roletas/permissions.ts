export function normalizeRoletaIds(ids: string[]) {
  return [...new Set(ids)].sort();
}

export function sameRoletaIds(left: string[] = [], right: string[] = []) {
  const normalizedLeft = normalizeRoletaIds(left);
  const normalizedRight = normalizeRoletaIds(right);
  return (
    normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((id, index) => id === normalizedRight[index])
  );
}

export function diffRoletaIds(currentIds: string[], desiredIds: string[]) {
  const current = new Set(currentIds);
  const desired = new Set(desiredIds);

  return {
    added: [...desired].filter((id) => !current.has(id)),
    removed: [...current].filter((id) => !desired.has(id)),
  };
}
