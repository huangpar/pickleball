import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Active Players" value="1,284" />);
    expect(screen.getByText("Active Players")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });

  it("renders an optional sublabel", () => {
    render(<StatCard label="Active Players" value="1,284" sublabel="+12% from last month" />);
    expect(screen.getByText("+12% from last month")).toBeInTheDocument();
  });

  it("omits the sublabel paragraph when not provided", () => {
    const { container } = render(<StatCard label="Active Players" value="1,284" />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });
});
