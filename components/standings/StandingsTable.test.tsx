import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StandingsTable } from "./StandingsTable";
import type { StandingRow } from "@/lib/standings";

const standings: StandingRow[] = [
  { id: "a", name: "Alex", wins: 5, losses: 5, matchesPlayed: 10, winPercentage: 90, pointDifferential: 8, trend: "flat" },
  { id: "b", name: "Bo", wins: 8, losses: 1, matchesPlayed: 9, winPercentage: 50, pointDifferential: 12, trend: "up" },
  { id: "c", name: "Cy", wins: 2, losses: 2, matchesPlayed: 4, winPercentage: 99, pointDifferential: -8, trend: "down" },
];

describe("StandingsTable", () => {
  it("defaults to sorting by wins descending", () => {
    render(<StandingsTable initialStandings={standings} />);
    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(within(rows[0]).getByText("Bo")).toBeInTheDocument();
  });

  it("re-sorts by win percentage when that tab is clicked", () => {
    render(<StandingsTable initialStandings={standings} />);
    fireEvent.click(screen.getByRole("button", { name: "Win %" }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Cy")).toBeInTheDocument();
  });

  it("renders both a desktop table (hidden below md) and a mobile card list (hidden at md and above) with the same rows", () => {
    render(<StandingsTable initialStandings={standings} />);

    const table = screen.getByTestId("standings-table");
    expect(table.className).toContain("hidden");
    expect(table.className).toContain("md:block");
    expect(table).toHaveTextContent("Alex");
    expect(table).toHaveTextContent("Bo");
    expect(table).toHaveTextContent("Cy");

    const cards = screen.getByTestId("standings-cards");
    expect(cards.className).toContain("md:hidden");
    expect(cards).toHaveTextContent("Alex");
    expect(cards).toHaveTextContent("Bo");
    expect(cards).toHaveTextContent("Cy");
  });

  it("displays W-L Record column on desktop table", () => {
    const testStandings: StandingRow[] = [
      { id: "p1", name: "Alice", wins: 5, losses: 2, matchesPlayed: 7, winPercentage: 71, pointDifferential: 12, trend: "up" },
    ];
    render(<StandingsTable initialStandings={testStandings} />);
    expect(screen.getByText("5W-2L")).toBeInTheDocument();
  });

  it("displays Point Diff column with correct formatting", () => {
    const testStandings: StandingRow[] = [
      { id: "p1", name: "Alice", wins: 5, losses: 2, matchesPlayed: 7, winPercentage: 71, pointDifferential: 12, trend: "up" },
      { id: "p2", name: "Bob", wins: 3, losses: 4, matchesPlayed: 7, winPercentage: 43, pointDifferential: -8, trend: "down" },
    ];
    render(<StandingsTable initialStandings={testStandings} />);
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText("-8")).toBeInTheDocument();
  });

  it("displays compressed metrics on mobile cards", () => {
    const testStandings: StandingRow[] = [
      { id: "p1", name: "Alice", wins: 5, losses: 2, matchesPlayed: 7, winPercentage: 71, pointDifferential: 12, trend: "up" },
    ];
    render(<StandingsTable initialStandings={testStandings} />);
    // Mobile card should show "5W-2L · +12 · ↑"
    expect(screen.getByText(/5W-2L.*\+12/)).toBeInTheDocument();
  });
});
