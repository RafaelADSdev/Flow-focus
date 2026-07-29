import { describe, expect, it } from "vitest";
import { diffRoletaIds, normalizeRoletaIds, sameRoletaIds } from "./permissions";

describe("roleta permissions", () => {
  it("normalizes duplicate ids before comparison", () => {
    expect(normalizeRoletaIds(["b", "a", "a"])).toEqual(["a", "b"]);
    expect(sameRoletaIds(["b", "a"], ["a", "b", "a"])).toBe(true);
  });

  it("returns additions and removals without touching unchanged ids", () => {
    expect(diffRoletaIds(["a", "b"], ["b", "c"])).toEqual({
      added: ["c"],
      removed: ["a"],
    });
  });
});
