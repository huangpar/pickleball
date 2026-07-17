import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchScoreForm } from "./MatchScoreForm";

describe("MatchScoreForm", () => {
  it("renders each side's names and score input on its own row, and submits edited values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={11}
        side2Score={7}
        disabled={false}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Alex Sterling")).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera")).toBeInTheDocument();
    expect(screen.getByLabelText("Side 1 score")).toHaveValue(11);
    fireEvent.change(screen.getByLabelText("Side 2 score"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("side1Score")).toBe("11");
    expect(formData.get("side2Score")).toBe("9");
  });

  it("shows an error message if onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Scores cannot be tied"));
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={null}
        side2Score={null}
        disabled={false}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText("Side 1 score"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Side 2 score"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Scores cannot be tied")).toBeInTheDocument();
  });

  it("renders read-only names and scores with no inputs when disabled", () => {
    const onSubmit = vi.fn();
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={11}
        side2Score={7}
        disabled={true}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Alex Sterling")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByLabelText("Side 1 score")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("shows a dash for an unplayed match when disabled", () => {
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={null}
        side2Score={null}
        disabled={true}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
