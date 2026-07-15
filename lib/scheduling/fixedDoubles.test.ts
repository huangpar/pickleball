import { describe, it, expect } from "vitest";
import { generateFixedDoublesSchedule } from "./fixedDoubles";

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
});
