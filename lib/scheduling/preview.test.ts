import { describe, it, expect } from "vitest";
import {
  computeSinglesPreview,
  computeFixedDoublesPreview,
  computeRotatingDoublesPreview,
  computeHybridDoublesPreview,
} from "./preview";

describe("computeSinglesPreview", () => {
  it("computes total matches and estimated duration for 4 participants on 2 courts", () => {
    const result = computeSinglesPreview(4, 2, 30);
    expect(result.totalMatches).toBe(6); // C(4,2)
    expect(result.estimatedMinutes).toBe(90); // ceil(6/2) rounds * 30 min = 3 * 30
  });

  it("returns zero matches for fewer than 2 participants", () => {
    expect(computeSinglesPreview(1, 2, 30)).toEqual({ totalMatches: 0, estimatedMinutes: 0 });
  });

  it("uses a custom round count instead of the natural round-robin length", () => {
    const result = computeSinglesPreview(4, 2, 30, 2); // 2 matches/round * 2 rounds
    expect(result.totalMatches).toBe(4);
  });

  it("scales past the natural round-robin length when more rounds are requested", () => {
    const result = computeSinglesPreview(4, 2, 30, 5); // 2 matches/round * 5 rounds
    expect(result.totalMatches).toBe(10);
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

describe("computeHybridDoublesPreview", () => {
  it("computes total matches from fixed pairs plus rotating pairs, times rounds", () => {
    // 2 fixed pairs + 4 rotating players (2 rotating pairs) = 4 teams/round -> 2 matches/round
    const result = computeHybridDoublesPreview(2, 4, 2, 30, 5);
    expect(result.totalMatches).toBe(10); // 2 matches/round * 5 rounds
    expect(result.estimatedMinutes).toBe(150); // ceil(10/2) * 30
  });

  it("accounts for an odd rotating player leaving one rotating player unpaired that round", () => {
    // 1 fixed pair + 3 rotating players (floor(3/2)=1 rotating pair) = 2 teams/round -> 1 match/round
    const result = computeHybridDoublesPreview(1, 3, 2, 30, 4);
    expect(result.totalMatches).toBe(4); // 1 match/round * 4 rounds
  });
});
