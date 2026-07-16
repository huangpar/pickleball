import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoundRobinSetupForm } from "./RoundRobinSetupForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const initialPlayers = [
  { id: "p1", name: "Alex Sterling", duprRating: "4.80" },
  { id: "p2", name: "Ben Rivera", duprRating: "4.20" },
  { id: "p3", name: "Chris Jung", duprRating: "3.80" },
  { id: "p4", name: "Dana Kim", duprRating: "4.00" },
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
});
