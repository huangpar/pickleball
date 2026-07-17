"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function MatchScoreForm({
  side1PlayerNames,
  side2PlayerNames,
  side1Score,
  side2Score,
  disabled,
  onSubmit,
}: {
  side1PlayerNames: string[];
  side2PlayerNames: string[];
  side1Score: number | null;
  side2Score: number | null;
  disabled: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (disabled) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-body">{side1PlayerNames.join(" & ")}</span>
          <span className="font-mono font-semibold">{side1Score ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-body">{side2PlayerNames.join(" & ")}</span>
          <span className="font-mono font-semibold">{side2Score ?? "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-body">{side1PlayerNames.join(" & ")}</span>
        <input
          name="side1Score"
          type="number"
          min={0}
          defaultValue={side1Score ?? ""}
          aria-label="Side 1 score"
          className="border border-outline-variant rounded px-2 py-1 w-16"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-body">{side2PlayerNames.join(" & ")}</span>
        <input
          name="side2Score"
          type="number"
          min={0}
          defaultValue={side2Score ?? ""}
          aria-label="Side 2 score"
          className="border border-outline-variant rounded px-2 py-1 w-16"
        />
      </div>
      <Button type="submit" variant="secondary">
        Save
      </Button>
      {error && <p className="text-error text-sm">{error}</p>}
    </form>
  );
}
