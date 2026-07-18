import { describe, it, expect } from "vitest";
import { isNavItemActive } from "./navItems";

describe("isNavItemActive", () => {
  it("matches the root path only when pathname is exactly '/'", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/tournaments", "/")).toBe(false);
  });

  it("matches non-root paths via startsWith, so nested routes still highlight", () => {
    expect(isNavItemActive("/tournaments/abc123", "/tournaments")).toBe(true);
    expect(isNavItemActive("/players", "/tournaments")).toBe(false);
  });
});
