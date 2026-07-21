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

function countByesByPlayer(schedule: ReturnType<typeof generateRotatingDoublesSchedule>, players: string[], numRounds: number) {
  const byeCounts = new Map<string, number>();
  for (const id of players) byeCounts.set(id, 0);

  for (let round = 1; round <= numRounds; round++) {
    const roundMatches = schedule.filter((m) => m.roundNumber === round);
    const playing = new Set(roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]));
    for (const id of players) {
      if (!playing.has(id)) {
        byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
      }
    }
  }

  return byeCounts;
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

  it("gives every player exactly one bye when byes divide evenly", () => {
    const fivePlayers = ["p1", "p2", "p3", "p4", "p5"];
    const numRounds = 5; // 1 sit-out per round (5 % 4 = 1) * 5 rounds = 5 total byes for 5 players
    const schedule = generateRotatingDoublesSchedule(fivePlayers, 2, numRounds, mulberry32(1));

    const byeCounts = countByesByPlayer(schedule, fivePlayers, numRounds);
    expect([...byeCounts.values()]).toEqual([1, 1, 1, 1, 1]);
  });

  it("keeps bye counts within 2 of each other when byes don't divide evenly", () => {
    const sevenPlayers = players.slice(0, 7);
    const numRounds = 4; // 3 sit-outs per round (7 % 4 = 3) * 4 rounds = 12 total byes for 7 players
    const schedule = generateRotatingDoublesSchedule(sevenPlayers, 2, numRounds, mulberry32(2));

    const byeCounts = countByesByPlayer(schedule, sevenPlayers, numRounds);
    const counts = [...byeCounts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it("achieves full partner coverage when there are enough rounds", () => {
    const eightPlayers = players; // p1..p8
    const numRounds = 14; // generous margin above the theoretical minimum of 7 for 8 players
    const schedule = generateRotatingDoublesSchedule(eightPlayers, 2, numRounds, mulberry32(11));

    const partneredPairs = new Set<string>();
    schedule.forEach((m) => {
      partneredPairs.add([...m.side1PlayerIds].sort().join("|"));
      partneredPairs.add([...m.side2PlayerIds].sort().join("|"));
    });

    const allPossiblePairs = new Set<string>();
    for (let i = 0; i < eightPlayers.length; i++) {
      for (let j = i + 1; j < eightPlayers.length; j++) {
        allPossiblePairs.add([eightPlayers[i], eightPlayers[j]].sort().join("|"));
      }
    }

    expect(partneredPairs.size).toBe(allPossiblePairs.size); // every possible pair partnered at least once
  });

  it("forms zero repeat partnerships when the round count doesn't require any repeats yet", () => {
    const eightPlayers = players; // p1..p8
    const numRounds = 4; // 4 rounds * 4 partnerships/round = 16 partnership-slots, well under the 28 possible pairs
    const schedule = generateRotatingDoublesSchedule(eightPlayers, 2, numRounds, mulberry32(1));

    const partnerships: string[] = [];
    schedule.forEach((m) => {
      partnerships.push([...m.side1PlayerIds].sort().join("|"));
      partnerships.push([...m.side2PlayerIds].sort().join("|"));
    });

    expect(new Set(partnerships).size).toBe(partnerships.length); // no partnership repeated
  });
});
