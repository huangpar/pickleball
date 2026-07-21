import { describe, it, expect } from "vitest";
import { generateFixedDoublesSchedule } from "./fixedDoubles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateFixedDoublesSchedule", () => {
  it("schedules every team against every other team exactly once, 2 players per side", () => {
    const teams: [string, string][] = [
      ["p1", "p2"],
      ["p3", "p4"],
      ["p5", "p6"],
      ["p7", "p8"],
    ];
    const schedule = generateFixedDoublesSchedule(teams, 2);

    expect(schedule).toHaveLength(6); // C(4,2) team pairings
    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
    });

    // team ["p1","p2"] should appear together on the same side every time it plays
    schedule.forEach((m) => {
      if (m.side1PlayerIds.includes("p1")) expect(m.side1PlayerIds).toContain("p2");
      if (m.side2PlayerIds.includes("p1")) expect(m.side2PlayerIds).toContain("p2");
    });
  });

  it("assigns firstServerId as one of the match's own 4 participants", () => {
    const teams: [string, string][] = [
      ["p1", "p2"],
      ["p3", "p4"],
      ["p5", "p6"],
      ["p7", "p8"],
    ];
    const schedule = generateFixedDoublesSchedule(teams, 2, mulberry32(7));
    schedule.forEach((m) => {
      const participants = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(participants).toContain(m.firstServerId);
    });

    const isSide1First = schedule.map((m) => m.side1PlayerIds.includes(m.firstServerId));
    expect(new Set(isSide1First).size).toBe(2); // both true and false occur across the schedule
  });
});
