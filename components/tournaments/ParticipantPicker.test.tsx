import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParticipantPicker } from "./ParticipantPicker";

describe("ParticipantPicker", () => {
  it("uses a single-column grid below md and two columns at md and above", () => {
    const players = [
      { id: "1", name: "Alex Sterling" },
      { id: "2", name: "Ben Rivera" },
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

  it("routes clicks on selected players to onPairClick instead of onToggle when pairLocking is active", () => {
    const onToggle = vi.fn();
    const onPairClick = vi.fn();
    const players = [
      { id: "1", name: "Alex Sterling" },
      { id: "2", name: "Ben Rivera" },
    ];
    render(
      <ParticipantPicker
        availablePlayers={players}
        selectedIds={["1"]}
        onToggle={onToggle}
        onPlayerAdded={vi.fn()}
        onCreatePlayer={vi.fn()}
        pairLocking={{ lockedPairs: [], armedId: null, onPairClick }}
      />
    );

    fireEvent.click(screen.getByLabelText("Alex Sterling")); // already selected -> pair click
    expect(onPairClick).toHaveBeenCalledWith("1");
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Ben Rivera")); // not yet selected -> normal toggle
    expect(onToggle).toHaveBeenCalledWith("2");
  });
});
