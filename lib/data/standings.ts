import { getAllPlayers, getPlayerMatchOutcomes } from "./players";
import { computeWins, computeWinPercentage, computeTrend } from "@/lib/stats";
import type { StandingRow } from "@/lib/standings";

export async function getStandings(): Promise<StandingRow[]> {
  const allPlayers = await getAllPlayers();

  const rows: StandingRow[] = [];
  for (const player of allPlayers) {
    const outcomes = await getPlayerMatchOutcomes(player.id);
    rows.push({
      id: player.id,
      name: player.name,
      duprRating: player.duprRating,
      wins: computeWins(outcomes),
      matchesPlayed: outcomes.length,
      winPercentage: computeWinPercentage(outcomes),
      trend: computeTrend(outcomes),
    });
  }
  return rows;
}
