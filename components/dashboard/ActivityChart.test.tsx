import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityChart } from "./ActivityChart";

describe("ActivityChart", () => {
  it("renders one bar per day with a title showing the match count", () => {
    const data = [
      { date: "2026-07-08", count: 2 },
      { date: "2026-07-09", count: 0 },
      { date: "2026-07-10", count: 5 },
      { date: "2026-07-11", count: 1 },
      { date: "2026-07-12", count: 3 },
      { date: "2026-07-13", count: 0 },
      { date: "2026-07-14", count: 4 },
    ];
    render(<ActivityChart data={data} />);
    expect(screen.getByTitle("5 matches")).toBeInTheDocument();
    expect(screen.getAllByTitle("0 matches").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle(/matches$/)).toHaveLength(7);
  });
});
