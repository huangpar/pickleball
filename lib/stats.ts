export interface MatchOutcome {
  matchId: string;
  playedAt: Date;
  won: boolean;
}

export function computeWins(outcomes: MatchOutcome[]): number {
  return outcomes.filter((o) => o.won).length;
}

export function computeWinPercentage(outcomes: MatchOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const wins = computeWins(outcomes);
  return Math.round((wins / outcomes.length) * 1000) / 10;
}

export function computeCurrentStreak(outcomes: MatchOutcome[]): { count: number; type: "W" | "L" | null } {
  if (outcomes.length === 0) return { count: 0, type: null };

  const mostRecent = outcomes[outcomes.length - 1];
  const type: "W" | "L" = mostRecent.won ? "W" : "L";
  let count = 0;

  for (let i = outcomes.length - 1; i >= 0; i--) {
    const isWin = outcomes[i].won;
    if ((type === "W" && isWin) || (type === "L" && !isWin)) {
      count++;
    } else {
      break;
    }
  }

  return { count, type };
}

export function computeTrend(outcomes: MatchOutcome[]): "up" | "down" | "flat" {
  if (outcomes.length === 0) return "flat";
  return outcomes[outcomes.length - 1].won ? "up" : "down";
}
