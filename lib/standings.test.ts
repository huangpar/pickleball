import { describe, it, expect } from "vitest";
import { rankPlayerByWins, sortStandings, standingsToCsv, type StandingRow } from "./standings";

function row(id: string, wins: number): StandingRow {
  return { id, name: id, wins, matchesPlayed: wins + 1, winPercentage: 50, trend: "flat" };
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

describe("sortStandings", () => {
  it("sorts by wins descending", () => {
    const standings = [row("a", 5), row("b", 10), row("c", 2)];
    expect(sortStandings(standings, "wins").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by win percentage descending", () => {
    const standings: StandingRow[] = [
      { ...row("a", 5), winPercentage: 90 },
      { ...row("b", 10), winPercentage: 50 },
      { ...row("c", 2), winPercentage: 99 },
    ];
    expect(sortStandings(standings, "winPercentage").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const standings = [row("a", 5), row("b", 10)];
    const original = [...standings];
    sortStandings(standings, "wins");
    expect(standings).toEqual(original);
  });
});

describe("standingsToCsv", () => {
  it("produces a header row plus one row per player, ranked by input order", () => {
    const standings = [row("a", 10), row("b", 5)];
    const csv = standingsToCsv(standings);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Rank,Player,Wins,Win %,Matches Played");
    expect(lines[1]).toBe("1,a,10,50,11");
    expect(lines[2]).toBe("2,b,5,50,6");
  });

  it("quotes player names containing a comma", () => {
    const standings: StandingRow[] = [{ ...row("a", 1), name: "Smith, Jr." }];
    const csv = standingsToCsv(standings);
    expect(csv.split("\n")[1]).toBe('1,"Smith, Jr.",1,50,2');
  });

  it("quotes player names containing a newline", () => {
    const standings: StandingRow[] = [{ ...row("a", 1), name: "Smith\nJr." }];
    const csv = standingsToCsv(standings);
    expect(csv).toContain('"Smith\nJr."');
  });
});
