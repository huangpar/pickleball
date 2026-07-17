import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TournamentStandingsTable } from "./TournamentStandingsTable";
import type { StandingRow } from "@/lib/standings";

describe("TournamentStandingsTable", () => {
  it("renders rows already in the order given, ranked from 1", () => {
    const standings: StandingRow[] = [
      { id: "a", name: "Alex", duprRating: "4.50", wins: 3, matchesPlayed: 3, winPercentage: 100, trend: "up" },
      { id: "b", name: "Bo", duprRating: "4.00", wins: 1, matchesPlayed: 3, winPercentage: 33.3, trend: "down" },
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
});
