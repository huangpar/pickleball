import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a <button> by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders a link when href is provided", () => {
    render(<Button href="/tournaments/new">Create Tournament</Button>);
    const link = screen.getByRole("link", { name: "Create Tournament" });
    expect(link).toHaveAttribute("href", "/tournaments/new");
  });
});
