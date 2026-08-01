import { describe, it, expect } from "vitest";
import { generateHybridDoublesSchedule } from "./hybridDoubles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countByesByPlayer(
  schedule: ReturnType<typeof generateHybridDoublesSchedule>,
  players: string[],
  numRounds: number
) {
  const byeCounts = new Map<string, number>();
  for (const id of players) byeCounts.set(id, 0);

  for (let round = 1; round <= numRounds; round++) {
    const roundMatches = schedule.filter((m) => m.roundNumber === round);
    const playing = new Set(roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]));
    for (const id of players) {
      if (!playing.has(id)) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
    }
  }

  return byeCounts;
}

describe("generateHybridDoublesSchedule", () => {
  const fixedPairs: [string, string][] = [
    ["f1", "f2"],
    ["f3", "f4"],
  ];
  const rotatingPlayerIds = ["r1", "r2", "r3", "r4"];

  it("keeps every fixed pair together as a side, never split or mixed with another player", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 6, mulberry32(1));

    fixedPairs.forEach(([a, b]) => {
      schedule.forEach((m) => {
        if (m.side1PlayerIds.includes(a) || m.side1PlayerIds.includes(b)) {
          expect(m.side1PlayerIds.sort()).toEqual([a, b].sort());
        }
        if (m.side2PlayerIds.includes(a) || m.side2PlayerIds.includes(b)) {
          expect(m.side2PlayerIds.sort()).toEqual([a, b].sort());
        }
      });
    });
  });

  it("never plays one fixed-pair member without the other in the same round", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 6, mulberry32(2));

    for (let round = 1; round <= 6; round++) {
      const playing = new Set(
        schedule.filter((m) => m.roundNumber === round).flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds])
      );
      fixedPairs.forEach(([a, b]) => {
        expect(playing.has(a)).toBe(playing.has(b));
      });
    }
  });

  it("gives every fixed-pair player exactly one partner: their locked partner, never anyone else", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 6, mulberry32(3));

    fixedPairs.forEach(([a, b]) => {
      const partnersOfA = new Set<string>();
      schedule.forEach((m) => {
        if (m.side1PlayerIds.includes(a)) m.side1PlayerIds.forEach((p) => p !== a && partnersOfA.add(p));
        if (m.side2PlayerIds.includes(a)) m.side2PlayerIds.forEach((p) => p !== a && partnersOfA.add(p));
      });
      expect(partnersOfA).toEqual(new Set([b]));
    });
  });

  it("achieves full partner coverage among rotating-pool players given enough rounds", () => {
    const numRounds = 12; // generous margin for 4 rotating players (3 possible pairs need covering... C(4,2)=6)
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, numRounds, mulberry32(11));

    const rotatingPartneredPairs = new Set<string>();
    schedule.forEach((m) => {
      [m.side1PlayerIds, m.side2PlayerIds].forEach((side) => {
        if (side.every((p) => rotatingPlayerIds.includes(p))) {
          rotatingPartneredPairs.add([...side].sort().join("|"));
        }
      });
    });

    const allPossibleRotatingPairs = new Set<string>();
    for (let i = 0; i < rotatingPlayerIds.length; i++) {
      for (let j = i + 1; j < rotatingPlayerIds.length; j++) {
        allPossibleRotatingPairs.add([rotatingPlayerIds[i], rotatingPlayerIds[j]].sort().join("|"));
      }
    }

    expect(rotatingPartneredPairs.size).toBe(allPossibleRotatingPairs.size);
  });

  it("keeps bye counts reasonably balanced across all players when the team count is often odd", () => {
    // 1 fixed pair + 4 rotating players (2 rotating pairs) = 3 teams per round (odd) -> 1 team byes each round
    const oneFixedPair: [string, string][] = [["f1", "f2"]];
    const numRounds = 6;
    const schedule = generateHybridDoublesSchedule(oneFixedPair, rotatingPlayerIds, 2, numRounds, mulberry32(5));

    const allPlayers = ["f1", "f2", ...rotatingPlayerIds];
    const byeCounts = countByesByPlayer(schedule, allPlayers, numRounds);
    const counts = [...byeCounts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it("produces valid matches with exactly 2 players per side and no double-booking within a round", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(6));

    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
    });

    for (let round = 1; round <= 4; round++) {
      const roundMatches = schedule.filter((m) => m.roundNumber === round);
      const playersThisRound = roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]);
      expect(new Set(playersThisRound).size).toBe(playersThisRound.length);
    }
  });

  it("assigns firstServerId as one of the match's own 4 participants", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(6));
    schedule.forEach((m) => {
      const participants = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(participants).toContain(m.firstServerId);
    });
  });

  it("is deterministic given the same seed", () => {
    const a = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(99));
    const b = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(99));
    expect(a).toEqual(b);
  });
});
