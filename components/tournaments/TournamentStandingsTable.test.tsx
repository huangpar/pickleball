import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TournamentStandingsTable } from "./TournamentStandingsTable";
import type { StandingRow } from "@/lib/standings";

describe("TournamentStandingsTable", () => {
  it("renders rows already in the order given, ranked from 1", () => {
    const standings: StandingRow[] = [
      { id: "a", name: "Alex", wins: 3, matchesPlayed: 3, winPercentage: 100, trend: "up" },
      { id: "b", name: "Bo", wins: 1, matchesPlayed: 3, winPercentage: 33.3, trend: "down" },
    ];
    render(<TournamentStandingsTable standings={standings} />);

    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows[0]).toHaveTextContent("01");
    expect(rows[0]).toHaveTextContent("Alex");
    expect(rows[1]).toHaveTextContent("02");
    expect(rows[1]).toHaveTextContent("Bo");
  });

  it("shows a placeholder message when there are no standings", () => {
    render(<TournamentStandingsTable standings={[]} />);
    expect(screen.getByText("No standings yet.")).toBeInTheDocument();
  });

  it("renders both a desktop table (hidden below md) and a mobile card list (hidden at md and above) with the same rows", () => {
    const standings: StandingRow[] = [
      { id: "a", name: "Alex", wins: 3, matchesPlayed: 3, winPercentage: 100, trend: "up" },
      { id: "b", name: "Bo", wins: 1, matchesPlayed: 3, winPercentage: 33.3, trend: "down" },
    ];
    render(<TournamentStandingsTable standings={standings} />);

    const table = screen.getByTestId("tournament-standings-table");
    expect(table.className).toContain("hidden");
    expect(table.className).toContain("md:block");
    expect(table).toHaveTextContent("Alex");
    expect(table).toHaveTextContent("Bo");

    const cards = screen.getByTestId("tournament-standings-cards");
    expect(cards.className).toContain("md:hidden");
    expect(cards).toHaveTextContent("Alex");
    expect(cards).toHaveTextContent("Bo");
  });
});
