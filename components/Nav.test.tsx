import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Nav } from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/standings",
}));

describe("Nav", () => {
  it("renders exactly the four required nav links", () => {
    render(<Nav />);
    const nav = screen.getByRole("navigation");
    const expected = ["Dashboard", "Tournaments", "Standings", "Players"];
    expected.forEach((label) => {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  it("highlights the link matching the current path", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Standings" }).className).toContain("bg-surface-container-high");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("bg-surface-container-high");
  });
});
