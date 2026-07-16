import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/standings",
}));

describe("Nav", () => {
  it("renders exactly the four required nav links", () => {
    render(<Nav />);
    const expected = ["Dashboard", "Tournaments", "Standings", "Players"];
    expected.forEach((label) => {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("highlights the link matching the current path", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Standings" }).className).toContain("text-secondary");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("text-secondary");
  });
});
