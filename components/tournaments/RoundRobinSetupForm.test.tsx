import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RoundRobinSetupForm } from "./RoundRobinSetupForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const initialPlayers = [
  { id: "p1", name: "Alex Sterling" },
  { id: "p2", name: "Ben Rivera" },
  { id: "p3", name: "Chris Jung" },
  { id: "p4", name: "Dana Kim" },
];

describe("RoundRobinSetupForm", () => {
  it("updates the singles match preview as participants are selected", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    expect(screen.getByText(/0 matches/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));

    expect(screen.getByText(/6 matches/i)).toBeInTheDocument(); // C(4,2)
  });

  it("shows a Number of Rounds field for singles that defaults to a full round robin", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));

    const roundsInput = screen.getByLabelText(/Number of Rounds/i);
    expect(roundsInput).toHaveValue(null); // blank by default -> full round robin
    expect(screen.getByText(/6 matches/i)).toBeInTheDocument(); // C(4,2)

    fireEvent.change(roundsInput, { target: { value: "2" } });
    expect(screen.getByText(/4 matches/i)).toBeInTheDocument(); // 2 matches/round * 2 rounds
  });

  it("omits numRounds from the submission when the singles rounds field is left blank", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ tournamentId: "t1" });
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={onSubmit} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("numRounds")).toBeNull();
  });

  it("includes a custom numRounds in the submission for singles when set", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ tournamentId: "t1" });
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={onSubmit} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.change(screen.getByLabelText(/Number of Rounds/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("numRounds")).toBe("5");
  });

  it("pairs selected participants into teams in selection order for fixed-team doubles", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));

    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Fixed Teams"));

    expect(screen.getByText("Alex Sterling & Ben Rivera")).toBeInTheDocument();
    expect(screen.getByText("Chris Jung & Dana Kim")).toBeInTheDocument();
    expect(screen.getByText(/1 match/i)).toBeInTheDocument(); // C(2,2) teams = 1 match
  });

  it("shows the Hybrid team mode option for doubles format", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Doubles"));

    expect(screen.getByLabelText("Hybrid")).toBeInTheDocument();
  });

  it("locks two clicked players into a fixed pair in hybrid mode, leaving the rest as the rotating pool", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));
    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Hybrid"));

    fireEvent.click(screen.getByLabelText("Alex Sterling")); // arm
    fireEvent.click(screen.getByLabelText("Ben Rivera")); // lock

    expect(screen.getByText("Alex Sterling & Ben Rivera")).toBeInTheDocument();
  });

  it("unlocks a fixed pair when either member is clicked again", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Hybrid"));
    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    expect(screen.getByText("Alex Sterling & Ben Rivera")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Alex Sterling")); // unlock

    expect(screen.queryByText("Alex Sterling & Ben Rivera")).not.toBeInTheDocument();
  });

  it("shows the Number of Rounds input and computes the preview for hybrid mode", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));
    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Hybrid"));
    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));

    const roundsInput = screen.getByLabelText(/Number of Rounds/i);
    fireEvent.change(roundsInput, { target: { value: "3" } });

    // 1 fixed pair + 2 rotating players (1 rotating pair) = 2 teams/round -> 1 match/round * 3 rounds = 3
    expect(screen.getByText(/3 matches/i)).toBeInTheDocument();
  });

  it("shows the returned error and does not navigate when onSubmit resolves with an error", async () => {
    pushMock.mockClear();
    const onSubmit = vi.fn().mockResolvedValue({ error: "Select at least 2 participants" });
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={onSubmit} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    expect(await screen.findByText("Select at least 2 participants")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to the new tournament when onSubmit succeeds", async () => {
    pushMock.mockClear();
    const onSubmit = vi.fn().mockResolvedValue({ tournamentId: "t1" });
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={onSubmit} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /generate bracket/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/tournaments/t1"));
  });
});
