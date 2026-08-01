import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EndTournamentButton } from "./EndTournamentButton";

describe("EndTournamentButton", () => {
  it("calls onEnd when the user confirms", async () => {
    const onEnd = vi.fn().mockResolvedValue(undefined);
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it("does not call onEnd when the user cancels the confirmation", () => {
    const onEnd = vi.fn();
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onEnd).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "End Tournament" })).toBeInTheDocument();
  });

  it("shows an error message if onEnd rejects", async () => {
    const onEnd = vi.fn().mockRejectedValue(new Error("Tournament not found"));
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Tournament not found")).toBeInTheDocument();
  });
});
