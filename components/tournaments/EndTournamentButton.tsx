"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function EndTournamentButton({ onEnd }: { onEnd: () => Promise<void> }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmClick() {
    setError(null);
    setIsEnding(true);
    try {
      await onEnd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsEnding(false);
      setIsConfirming(false);
    }
  }

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-on-surface-variant">End tournament? Scores can no longer be edited.</span>
        <Button variant="secondary" onClick={handleConfirmClick} disabled={isEnding}>
          {isEnding ? "Ending..." : "Confirm"}
        </Button>
        <Button variant="tertiary" onClick={() => setIsConfirming(false)} disabled={isEnding}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button variant="secondary" onClick={() => setIsConfirming(true)}>
        End Tournament
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
