import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EndTournamentButton } from "./EndTournamentButton";

describe("EndTournamentButton", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm");
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("calls onEnd when the user confirms", async () => {
    confirmSpy.mockReturnValue(true);
    const onEnd = vi.fn().mockResolvedValue(undefined);
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));

    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it("does not call onEnd when the user cancels the confirmation", () => {
    confirmSpy.mockReturnValue(false);
    const onEnd = vi.fn();
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));

    expect(onEnd).not.toHaveBeenCalled();
  });

  it("shows an error message if onEnd rejects", async () => {
    confirmSpy.mockReturnValue(true);
    const onEnd = vi.fn().mockRejectedValue(new Error("Tournament not found"));
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));

    expect(await screen.findByText("Tournament not found")).toBeInTheDocument();
  });
});
