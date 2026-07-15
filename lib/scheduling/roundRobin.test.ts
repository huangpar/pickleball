import { describe, it, expect } from "vitest";
import { roundRobinRounds } from "./roundRobin";

describe("roundRobinRounds", () => {
  it("pairs every item with every other item exactly once for an even count", () => {
    const rounds = roundRobinRounds(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3); // n - 1 rounds

    const seenPairs = new Set<string>();
    rounds.forEach((round) => {
      const seenThisRound = new Set<string>();
      round.forEach(({ side1, side2 }) => {
        expect(seenThisRound.has(side1)).toBe(false);
        expect(seenThisRound.has(side2)).toBe(false);
        seenThisRound.add(side1);
        seenThisRound.add(side2);
        seenPairs.add([side1, side2].sort().join("|"));
      });
    });

    // C(4,2) = 6 unique pairs total
    expect(seenPairs.size).toBe(6);
  });

  it("adds a bye for an odd count so nobody is scheduled twice in a round", () => {
    const rounds = roundRobinRounds(["A", "B", "C"]);
    expect(rounds).toHaveLength(3); // (n rounded up to even) - 1 = 3

    rounds.forEach((round) => {
      const players = round.flatMap((m) => [m.side1, m.side2]);
      expect(new Set(players).size).toBe(players.length); // no duplicates within a round
      expect(round.length).toBeLessThanOrEqual(1); // 3 players -> at most 1 match per round
    });

    const seenPairs = new Set<string>();
    rounds.forEach((round) => round.forEach(({ side1, side2 }) => seenPairs.add([side1, side2].sort().join("|"))));
    expect(seenPairs.size).toBe(3); // C(3,2) = 3 unique pairs
  });

  it("returns no rounds for fewer than 2 items", () => {
    expect(roundRobinRounds(["A"])).toEqual([]);
    expect(roundRobinRounds([])).toEqual([]);
  });
});
