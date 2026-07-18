import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/players",
}));

describe("BottomNav", () => {
  it("renders exactly the four required nav links", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation");
    const expected = ["Dashboard", "Tournaments", "Standings", "Players"];
    expected.forEach((label) => {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  it("highlights the link matching the current path", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Players" }).className).toContain("bg-surface-container-high");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("bg-surface-container-high");
  });

  it("is hidden at md and above, and fixed to the bottom of the viewport below md", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("md:hidden");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");
  });
});
