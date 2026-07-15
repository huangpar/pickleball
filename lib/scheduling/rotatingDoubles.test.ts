import { describe, it, expect } from "vitest";
import { generateRotatingDoublesSchedule } from "./rotatingDoubles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateRotatingDoublesSchedule", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

  it("produces 2 matches per round for 8 players (groups of 4), 4 distinct players per match", () => {
    const schedule = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(42));
    const rounds = new Set(schedule.map((m) => m.roundNumber));
    expect(rounds.size).toBe(3);

    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
      const all = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(new Set(all).size).toBe(4); // no repeated player within a match
    });

    [1, 2, 3].forEach((roundNumber) => {
      const roundMatches = schedule.filter((m) => m.roundNumber === roundNumber);
      expect(roundMatches).toHaveLength(2); // 8 players / 4 per match
      const playersThisRound = roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]);
      expect(new Set(playersThisRound).size).toBe(playersThisRound.length); // nobody double-booked
    });
  });

  it("sits out leftover players when count isn't divisible by 4", () => {
    const sevenPlayers = players.slice(0, 7);
    const schedule = generateRotatingDoublesSchedule(sevenPlayers, 2, 2, mulberry32(7));
    [1, 2].forEach((roundNumber) => {
      const roundMatches = schedule.filter((m) => m.roundNumber === roundNumber);
      expect(roundMatches).toHaveLength(1); // floor(7/4) = 1 match, 3 players sit out
    });
  });

  it("is deterministic given the same seed", () => {
    const a = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(99));
    const b = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(99));
    expect(a).toEqual(b);
  });
});
