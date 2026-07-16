import { describe, it, expect } from "vitest";
import { rankPlayerByWins, type StandingRow } from "./standings";

function row(id: string, wins: number): StandingRow {
  return { id, name: id, duprRating: "4.00", wins, matchesPlayed: wins + 1, winPercentage: 50, trend: "flat" };
}

describe("rankPlayerByWins", () => {
  it("ranks players by wins descending, 1-indexed", () => {
    const standings = [row("a", 5), row("b", 10), row("c", 2)];
    expect(rankPlayerByWins(standings, "b")).toEqual({ rank: 1, totalPlayers: 3 });
    expect(rankPlayerByWins(standings, "a")).toEqual({ rank: 2, totalPlayers: 3 });
    expect(rankPlayerByWins(standings, "c")).toEqual({ rank: 3, totalPlayers: 3 });
  });

  it("returns rank 0 if the player isn't found", () => {
    const standings = [row("a", 5)];
    expect(rankPlayerByWins(standings, "missing")).toEqual({ rank: 0, totalPlayers: 1 });
  });
});
