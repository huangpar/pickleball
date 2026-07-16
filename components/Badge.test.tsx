import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its label text", () => {
    render(<Badge>Final</Badge>);
    expect(screen.getByText("Final")).toBeInTheDocument();
  });
});
