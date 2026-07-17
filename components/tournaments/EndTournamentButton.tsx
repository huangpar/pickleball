"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function EndTournamentButton({ onEnd }: { onEnd: () => Promise<void> }) {
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("End this tournament? Scores will no longer be editable.")) {
      return;
    }
    setError(null);
    setIsEnding(true);
    try {
      await onEnd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsEnding(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={isEnding}>
        {isEnding ? "Ending..." : "End Tournament"}
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
