export interface StandingRow {
  id: string;
  name: string;
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
