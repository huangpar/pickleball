import { getAllPlayers, getPlayerMatchOutcomes, type DateRange } from "./players";
import { computeWins, computeWinPercentage, computeTrend } from "@/lib/stats";
import { computePointDifferential, type StandingRow } from "@/lib/standings";

export async function getStandings(
  dateRange?: DateRange,
  matchFormat?: "singles" | "doubles"
): Promise<StandingRow[]> {
  const allPlayers = await getAllPlayers();

  const rows: StandingRow[] = [];
  for (const player of allPlayers) {
    const outcomes = await getPlayerMatchOutcomes(player.id, dateRange, matchFormat);

    // Convert PlayerMatchOutcome to MatchOutcome for stats functions
    const matchOutcomes = outcomes.map((o) => ({
      matchId: o.matchId,
      playedAt: new Date(),
      won: o.won,
    }));

    const wins = computeWins(matchOutcomes);
    rows.push({
      id: player.id,
      name: player.name,
      wins,
      losses: outcomes.length - wins,
      matchesPlayed: outcomes.length,
      winPercentage: computeWinPercentage(matchOutcomes),
      pointDifferential: computePointDifferential(outcomes),
      trend: computeTrend(matchOutcomes),
    });
  }
  return rows;
}
