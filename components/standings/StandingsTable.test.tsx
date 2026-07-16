import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StandingsTable } from "./StandingsTable";
import type { StandingRow } from "@/lib/standings";

const standings: StandingRow[] = [
  { id: "a", name: "Alex", duprRating: "4.50", wins: 5, matchesPlayed: 10, winPercentage: 90, trend: "flat" },
  { id: "b", name: "Bo", duprRating: "4.00", wins: 8, matchesPlayed: 9, winPercentage: 50, trend: "up" },
  { id: "c", name: "Cy", duprRating: "3.80", wins: 2, matchesPlayed: 4, winPercentage: 99, trend: "down" },
];

beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
});

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

  it("generates a CSV blob when Export CSV is clicked", () => {
    render(<StandingsTable initialStandings={standings} />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
