import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StartTournamentButton } from "./StartTournamentButton";

describe("StartTournamentButton", () => {
  it("calls onStart when clicked", async () => {
    const onStart = vi.fn().mockResolvedValue({});
    render(<StartTournamentButton onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Tournament" }));

    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
  });

  it("shows an error message if onStart resolves with an error instead of throwing", async () => {
    const onStart = vi.fn().mockResolvedValue({ error: "Tournament has already been started" });
    render(<StartTournamentButton onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Tournament" }));

    expect(await screen.findByText("Tournament has already been started")).toBeInTheDocument();
  });

  it("shows an error message if onStart rejects", async () => {
    const onStart = vi.fn().mockRejectedValue(new Error("Tournament not found"));
    render(<StartTournamentButton onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Tournament" }));

    expect(await screen.findByText("Tournament not found")).toBeInTheDocument();
  });
});
