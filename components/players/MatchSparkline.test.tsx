import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchSparkline } from "./MatchSparkline";

describe("MatchSparkline", () => {
  it("shows a placeholder message when there are no matches", () => {
    render(<MatchSparkline results={[]} />);
    expect(screen.getByText("No matches played yet")).toBeInTheDocument();
  });

  it("renders at most the last 15 results", () => {
    const results = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
    const { container } = render(<MatchSparkline results={results} />);
    expect(container.querySelectorAll("span[title]")).toHaveLength(15);
  });

  it("labels wins and losses distinctly", () => {
    render(<MatchSparkline results={[true, false]} />);
    expect(screen.getByTitle("Win")).toBeInTheDocument();
    expect(screen.getByTitle("Loss")).toBeInTheDocument();
  });
});
