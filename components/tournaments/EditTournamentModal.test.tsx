import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditTournamentModal } from "./EditTournamentModal";
import { editTournament } from "@/lib/actions/tournaments";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/tournaments", () => ({ editTournament: vi.fn() }));

describe("EditTournamentModal", () => {
  const mockPlayers = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Charlie" },
  ];

  it("renders the modal only when isOpen is true", () => {
    const { rerender } = render(
      <EditTournamentModal
        isOpen={false}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );
    expect(screen.queryByText("Edit Tournament")).not.toBeInTheDocument();

    rerender(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );
    expect(screen.getByText("Edit Tournament")).toBeInTheDocument();
  });

  it("shows participant picker with current participants pre-selected", () => {
    render(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );

    expect(screen.getByLabelText("Alice")).toBeChecked();
    expect(screen.getByLabelText("Bob")).toBeChecked();
    expect(screen.getByLabelText("Charlie")).not.toBeChecked();
  });

  it("shows rounds input only for doubles format", () => {
    const { rerender } = render(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );
    expect(screen.queryByLabelText(/Number of Rounds/i)).not.toBeInTheDocument();

    rerender(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="doubles"
      />
    );
    expect(screen.getByLabelText(/Number of Rounds/i)).toBeInTheDocument();
  });

  it("closes modal on cancel", () => {
    const onClose = vi.fn();
    render(
      <EditTournamentModal
        isOpen={true}
        onClose={onClose}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the returned error and keeps the modal open instead of throwing", async () => {
    vi.mocked(editTournament).mockResolvedValueOnce({ error: "Cannot re-edit fixed/hybrid teams (no stored mapping)" });
    const onClose = vi.fn();
    render(
      <EditTournamentModal
        isOpen={true}
        onClose={onClose}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="doubles"
      />
    );

    fireEvent.click(screen.getByText("Save Changes"));

    expect(await screen.findByText("Cannot re-edit fixed/hybrid teams (no stored mapping)")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes and refreshes when editTournament succeeds", async () => {
    vi.mocked(editTournament).mockResolvedValueOnce({});
    const onClose = vi.fn();
    render(
      <EditTournamentModal
        isOpen={true}
        onClose={onClose}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
