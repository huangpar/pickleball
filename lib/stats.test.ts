import { describe, it, expect } from "vitest";
import { computeWins, computeWinPercentage, computeCurrentStreak, computeTrend, type MatchOutcome } from "./stats";

function outcome(won: boolean, daysAgo: number): MatchOutcome {
  return { matchId: `m-${daysAgo}`, playedAt: new Date(Date.now() - daysAgo * 86400000), won };
}

describe("computeWins", () => {
  it("counts wins only", () => {
    const outcomes = [outcome(true, 3), outcome(false, 2), outcome(true, 1)];
    expect(computeWins(outcomes)).toBe(2);
  });

  it("returns 0 for no matches", () => {
    expect(computeWins([])).toBe(0);
  });
});

describe("computeWinPercentage", () => {
  it("returns win percentage rounded to 1 decimal", () => {
    const outcomes = [outcome(true, 3), outcome(false, 2), outcome(true, 1)];
    expect(computeWinPercentage(outcomes)).toBeCloseTo(66.7, 1);
  });

  it("returns 0 for no matches", () => {
    expect(computeWinPercentage([])).toBe(0);
  });
});

describe("computeCurrentStreak", () => {
  it("counts consecutive identical results ending at the most recent match", () => {
    // ascending by playedAt: oldest first
    const outcomes = [outcome(true, 5), outcome(false, 4), outcome(true, 3), outcome(true, 2), outcome(true, 1)];
    expect(computeCurrentStreak(outcomes)).toEqual({ count: 3, type: "W" });
  });

  it("counts a losing streak", () => {
    const outcomes = [outcome(true, 3), outcome(false, 2), outcome(false, 1)];
    expect(computeCurrentStreak(outcomes)).toEqual({ count: 2, type: "L" });
  });

  it("returns count 0 and type null for no matches", () => {
    expect(computeCurrentStreak([])).toEqual({ count: 0, type: null });
  });
});

describe("computeTrend", () => {
  it("is 'up' when the most recent match was a win", () => {
    const outcomes = [outcome(false, 2), outcome(true, 1)];
    expect(computeTrend(outcomes)).toBe("up");
  });

  it("is 'down' when the most recent match was a loss", () => {
    const outcomes = [outcome(true, 2), outcome(false, 1)];
    expect(computeTrend(outcomes)).toBe("down");
  });

  it("is 'flat' for no matches", () => {
    expect(computeTrend([])).toBe("flat");
  });
});
