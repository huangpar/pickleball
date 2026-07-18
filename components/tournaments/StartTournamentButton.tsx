"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function StartTournamentButton({ onStart }: { onStart: () => Promise<void> }) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsStarting(true);
    try {
      await onStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsStarting(false);
    }
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={isStarting}>
        {isStarting ? "Starting..." : "Start Tournament"}
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
