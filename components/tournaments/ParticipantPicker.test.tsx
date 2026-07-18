import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticipantPicker } from "./ParticipantPicker";

describe("ParticipantPicker", () => {
  it("uses a single-column grid below md and two columns at md and above", () => {
    const players = [
      { id: "1", name: "Alex Sterling", duprRating: "4.50" },
      { id: "2", name: "Ben Rivera", duprRating: "4.20" },
    ];
    render(
      <ParticipantPicker
        availablePlayers={players}
        selectedIds={[]}
        onToggle={vi.fn()}
        onPlayerAdded={vi.fn()}
        onCreatePlayer={vi.fn()}
      />
    );

    const grid = screen.getByLabelText("Alex Sterling").closest("label")!.parentElement!;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
  });
});
