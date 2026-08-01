import type { PlayerMatchOutcome } from "@/lib/data/players";

export interface StandingRow {
  id: string;
  name: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winPercentage: number;
  pointDifferential: number;
  trend: "up" | "down" | "flat";
}

export function computePointDifferential(outcomes: PlayerMatchOutcome[]): number {
  return outcomes
    .filter((outcome) => outcome.match.status === "final")
    .reduce((diff, outcome) => {
      const playerScore = outcome.side === 1 ? outcome.match.side1Score : outcome.match.side2Score;
      const opponentScore = outcome.side === 1 ? outcome.match.side2Score : outcome.match.side1Score;

      if (playerScore === null || opponentScore === null) return diff;

      return diff + (playerScore - opponentScore);
    }, 0);
}

export function rankPlayerByWins(
  standings: StandingRow[],
  playerId: string
): { rank: number; totalPlayers: number } {
  const sorted = [...standings].sort((a, b) => b.wins - a.wins);
  const index = sorted.findIndex((s) => s.id === playerId);
  return { rank: index === -1 ? 0 : index + 1, totalPlayers: sorted.length };
}

export type StandingsSort = "wins" | "winPercentage";

export function sortStandings(rows: StandingRow[], sortBy: StandingsSort): StandingRow[] {
  return [...rows].sort((a, b) => b[sortBy] - a[sortBy]);
}

export function standingsToCsv(rows: StandingRow[]): string {
  const header = "Rank,Player,Wins,Win %,Matches Played";
  const lines = rows.map(
    (row, i) => `${i + 1},${escapeCsvField(row.name)},${row.wins},${row.winPercentage},${row.matchesPlayed}`
  );
  return [header, ...lines].join("\n");
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
