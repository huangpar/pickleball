import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartnerBreakdown } from "./PartnerBreakdown";
import type { PartnerBreakdown as PartnerBreakdownData } from "@/lib/data/partnerBreakdown";

describe("PartnerBreakdown", () => {
  const sampleBreakdown: PartnerBreakdownData[] = [
    {
      partnerName: "Casey Nguyen",
      wins: 3,
      losses: 1,
      winPercentage: 75,
      opponents: [
        { opponentNames: ["Ben Rivera", "Dana Kim"], wins: 2, losses: 0 },
        { opponentNames: ["Emery Cole", "Frank Diaz"], wins: 1, losses: 1 },
      ],
    },
  ];

  it("renders nothing when the breakdown is empty", () => {
    const { container } = render(<PartnerBreakdown breakdown={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the dropdown with no breakdown visible until a partner is selected", () => {
    render(<PartnerBreakdown breakdown={sampleBreakdown} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText(/Overall with/)).not.toBeInTheDocument();
  });

  it("shows the overall record and per-opponent breakdown after selecting a partner", () => {
    render(<PartnerBreakdown breakdown={sampleBreakdown} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Casey Nguyen" } });

    expect(screen.getByText(/Overall with Casey Nguyen: 3-1/)).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera & Dana Kim")).toBeInTheDocument();
    expect(screen.getByText("2-0")).toBeInTheDocument();
    expect(screen.getByText("Emery Cole & Frank Diaz")).toBeInTheDocument();
    expect(screen.getByText("1-1")).toBeInTheDocument();
  });
});
