import { describe, it, expect } from "vitest";
import { generateSinglesSchedule } from "./singles";

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
});
