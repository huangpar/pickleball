"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function MatchScoreForm({
  side1PlayerNames,
  side2PlayerNames,
  side1Score,
  side2Score,
  firstServerName,
  disabled,
  onSubmit,
}: {
  side1PlayerNames: string[];
  side2PlayerNames: string[];
  side1Score: number | null;
  side2Score: number | null;
  firstServerName: string | null;
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

  const side1Won = side1Score !== null && side2Score !== null && side1Score > side2Score;
  const side2Won = side1Score !== null && side2Score !== null && side2Score > side1Score;

  const getRowClass = (isWinner: boolean) => {
    return `flex items-center justify-between px-4 py-3 ${
      isWinner
        ? "bg-[#f2fbf6] border-l-[3px] border-[#206a56]"
        : "bg-surface-container-lowest border-l-[3px] border-transparent"
    }`;
  };

  const getNameClass = (isWinner: boolean) => {
    return `font-body font-medium ${isWinner ? "text-on-surface" : "text-on-surface-variant"}`;
  };

  const getScoreClass = (isWinner: boolean) => {
    return `font-mono font-bold ${
      isWinner ? "text-[#206a56] text-xl" : "text-outline text-xl"
    }`;
  };

  function renderSideName(isWinner: boolean, playerNames: string[]) {
    const servesFirst = firstServerName !== null && playerNames.includes(firstServerName);
    return (
      <span className={getNameClass(isWinner)}>
        {playerNames.join(" & ")}
        {servesFirst && (
          <span className="text-on-surface-variant font-normal"> · {firstServerName} serves first</span>
        )}
      </span>
    );
  }

  if (disabled) {
    return (
      <div className="divide-y divide-outline-variant/30">
        <div className={getRowClass(side1Won)}>
          {renderSideName(side1Won, side1PlayerNames)}
          <span className={getScoreClass(side1Won)}>{side1Score ?? "—"}</span>
        </div>
        <div className={getRowClass(side2Won)}>
          {renderSideName(side2Won, side2PlayerNames)}
          <span className={getScoreClass(side2Won)}>{side2Score ?? "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="divide-y divide-outline-variant/30">
      <div className={getRowClass(side1Won)}>
        {renderSideName(side1Won, side1PlayerNames)}
        <input
          name="side1Score"
          type="number"
          min={0}
          defaultValue={side1Score ?? ""}
          aria-label="Side 1 score"
          className={`border border-outline-variant rounded px-2 py-1 w-16 text-center bg-white ${getScoreClass(side1Won)}`}
        />
      </div>
      <div className={getRowClass(side2Won)}>
        {renderSideName(side2Won, side2PlayerNames)}
        <input
          name="side2Score"
          type="number"
          min={0}
          defaultValue={side2Score ?? ""}
          aria-label="Side 2 score"
          className={`border border-outline-variant rounded px-2 py-1 w-16 text-center bg-white ${getScoreClass(side2Won)}`}
        />
      </div>
      <div className="p-3 flex items-center justify-between bg-surface-container-lowest border-t border-outline-variant/30">
        {error ? <p className="text-error text-sm">{error}</p> : <div />}
        <Button type="submit" variant="secondary">
          Save
        </Button>
      </div>
    </form>
  );
}
