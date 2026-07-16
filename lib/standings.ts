export interface StandingRow {
  id: string;
  name: string;
  duprRating: string;
  wins: number;
  matchesPlayed: number;
  winPercentage: number;
  trend: "up" | "down" | "flat";
}

export function rankPlayerByWins(
  standings: StandingRow[],
  playerId: string
): { rank: number; totalPlayers: number } {
  const sorted = [...standings].sort((a, b) => b.wins - a.wins);
  const index = sorted.findIndex((s) => s.id === playerId);
  return { rank: index === -1 ? 0 : index + 1, totalPlayers: sorted.length };
}
