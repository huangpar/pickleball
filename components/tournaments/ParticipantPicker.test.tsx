import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("adds and selects a newly created player", async () => {
    const onToggle = vi.fn();
    const onPlayerAdded = vi.fn();
    const onCreatePlayer = vi.fn().mockResolvedValue({ player: { id: "3", name: "Casey Nguyen" } });
    render(
      <ParticipantPicker
        availablePlayers={[]}
        selectedIds={[]}
        onToggle={onToggle}
        onPlayerAdded={onPlayerAdded}
        onCreatePlayer={onCreatePlayer}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Casey Nguyen" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Player" }));

    await waitFor(() => expect(onPlayerAdded).toHaveBeenCalledWith({ id: "3", name: "Casey Nguyen" }));
    expect(onToggle).toHaveBeenCalledWith("3");
  });

  it("shows an error instead of adding a player when onCreatePlayer resolves with an error", async () => {
    const onPlayerAdded = vi.fn();
    const onCreatePlayer = vi.fn().mockResolvedValue({ error: "Name is required" });
    render(
      <ParticipantPicker
        availablePlayers={[]}
        selectedIds={[]}
        onToggle={vi.fn()}
        onPlayerAdded={onPlayerAdded}
        onCreatePlayer={onCreatePlayer}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Player" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onPlayerAdded).not.toHaveBeenCalled();
  });
});
