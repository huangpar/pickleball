import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("takes the first letter of the first and last name", () => {
    expect(getInitials("Sarah Waters")).toBe("SW");
  });

  it("handles a single-word name by taking its first two letters", () => {
    expect(getInitials("Cher")).toBe("CH");
  });

  it("ignores extra whitespace", () => {
    expect(getInitials("  Bob   Marley  ")).toBe("BM");
  });

  it("handles a three-part name by using first and last only", () => {
    expect(getInitials("Mary Jane Watson")).toBe("MW");
  });

  it("returns an empty string for an empty name", () => {
    expect(getInitials("")).toBe("");
  });
});
