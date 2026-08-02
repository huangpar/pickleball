import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteTournamentButton } from "./DeleteTournamentButton";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("DeleteTournamentButton", () => {
  it("calls onDelete when the user confirms", async () => {
    const onDelete = vi.fn().mockResolvedValue({});
    render(<DeleteTournamentButton tournamentName="Test Cup" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Test Cup" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it("does not call onDelete when the user cancels the confirmation", () => {
    const onDelete = vi.fn();
    render(<DeleteTournamentButton tournamentName="Test Cup" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Test Cup" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows an error message if onDelete rejects", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("Tournament not found"));
    render(<DeleteTournamentButton tournamentName="Test Cup" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Test Cup" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Tournament not found")).toBeInTheDocument();
  });

  it("shows an error message if onDelete resolves with an error instead of throwing", async () => {
    const onDelete = vi.fn().mockResolvedValue({ error: "Tournament not found" });
    render(<DeleteTournamentButton tournamentName="Test Cup" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Test Cup" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Tournament not found")).toBeInTheDocument();
  });
});
