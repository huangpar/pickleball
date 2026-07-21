import { describe, it, expect } from "vitest";
import { generateSinglesSchedule } from "./singles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateSinglesSchedule", () => {
  it("schedules every pair exactly once across n-1 rounds, 1 player per side", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const schedule = generateSinglesSchedule(players, 2);

    expect(schedule).toHaveLength(6); // C(4,2)
    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(1);
      expect(m.side2PlayerIds).toHaveLength(1);
    });

    const rounds = new Set(schedule.map((m) => m.roundNumber));
    expect(rounds.size).toBe(3);
  });

  it("distributes matches across courts within a round, starting from court 1", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const schedule = generateSinglesSchedule(players, 2);
    const round1 = schedule.filter((m) => m.roundNumber === 1);
    expect(round1).toHaveLength(3); // 6 players -> 3 matches per round
    expect(round1.map((m) => m.courtNumber).sort()).toEqual([1, 1, 2]); // 3 matches, 2 courts -> court reused
  });

  it("assigns firstServerId as one of the match's own participants", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const schedule = generateSinglesSchedule(players, 2, mulberry32(3));
    schedule.forEach((m) => {
      const participants = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(participants).toContain(m.firstServerId);
    });
  });

  it("doesn't always assign the same position as first server", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const schedule = generateSinglesSchedule(players, 2, mulberry32(3));
    const isSide1First = schedule.map((m) => m.firstServerId === m.side1PlayerIds[0]);
    expect(new Set(isSide1First).size).toBe(2); // both true and false occur across the schedule
  });
});
