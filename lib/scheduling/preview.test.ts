import { describe, it, expect } from "vitest";
import { computeSinglesPreview, computeFixedDoublesPreview, computeRotatingDoublesPreview } from "./preview";

describe("computeSinglesPreview", () => {
  it("computes total matches and estimated duration for 4 participants on 2 courts", () => {
    const result = computeSinglesPreview(4, 2, 30);
    expect(result.totalMatches).toBe(6); // C(4,2)
    expect(result.estimatedMinutes).toBe(90); // ceil(6/2) rounds * 30 min = 3 * 30
  });

  it("returns zero matches for fewer than 2 participants", () => {
    expect(computeSinglesPreview(1, 2, 30)).toEqual({ totalMatches: 0, estimatedMinutes: 0 });
  });
});

describe("computeFixedDoublesPreview", () => {
  it("computes total matches from team count", () => {
    const result = computeFixedDoublesPreview(4, 2, 30); // 4 teams
    expect(result.totalMatches).toBe(6); // C(4,2)
    expect(result.estimatedMinutes).toBe(90);
  });
});

describe("computeRotatingDoublesPreview", () => {
  it("computes total matches from rounds and group size", () => {
    const result = computeRotatingDoublesPreview(8, 2, 30, 5); // 8 players -> 2 matches/round
    expect(result.totalMatches).toBe(10); // 2 matches/round * 5 rounds
    expect(result.estimatedMinutes).toBe(150); // ceil(10/2) * 30
  });
});
