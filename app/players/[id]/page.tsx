import { notFound } from "next/navigation";
import { getPlayerById, getPlayerMatchOutcomes } from "@/lib/data/players";
import { getPlayerMatchHistory } from "@/lib/data/matchHistory";
import { getStandings } from "@/lib/data/standings";
import { rankPlayerByWins } from "@/lib/standings";
import { computeWins, computeWinPercentage, computeCurrentStreak } from "@/lib/stats";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { MatchSparkline } from "@/components/players/MatchSparkline";

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [outcomes, history, standings] = await Promise.all([
    getPlayerMatchOutcomes(player.id),
    getPlayerMatchHistory(player.id),
    getStandings(),
  ]);

  const { rank, totalPlayers } = rankPlayerByWins(standings, player.id);
  const wins = computeWins(outcomes);
  const losses = outcomes.length - wins;
  const winPercentage = computeWinPercentage(outcomes);
  const streak = computeCurrentStreak(outcomes);

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Avatar name={player.name} />
        <div>
          <h1 className="font-headline text-3xl font-bold">{player.name}</h1>
          <p className="font-mono text-sm text-on-surface-variant">{player.duprRating} DUPR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Global Rank" value={`#${rank}`} sublabel={`of ${totalPlayers} players`} />
        <StatCard label="Win/Loss Record" value={`${wins}-${losses}`} />
        <StatCard label="Win %" value={`${winPercentage}%`} />
        <StatCard label="Current Streak" value={streak.type ? `${streak.count}${streak.type}` : "—"} />
      </div>

      <Card>
        <h2 className="font-headline text-lg font-semibold mb-4">Recent Form</h2>
        <MatchSparkline results={outcomes.map((o) => o.won)} />
      </Card>

      <Card className="p-0 divide-y divide-surface-container-high">
        <h2 className="font-headline text-lg font-semibold p-6 pb-0">Match History</h2>
        {history.length === 0 && <p className="p-6 text-on-surface-variant">No matches played yet.</p>}
        {history.map((entry) => (
          <div key={entry.matchId} className="flex items-center justify-between p-6">
            <div>
              <p className="font-body font-medium">
                vs. {entry.opponentNames.join(" & ")}
                {entry.partnerNames.length > 0 && (
                  <span className="text-on-surface-variant"> (with {entry.partnerNames.join(" & ")})</span>
                )}
              </p>
              <p className="font-mono text-xs text-on-surface-variant">{entry.tournamentName}</p>
            </div>
            <p className={`font-headline font-semibold ${entry.won ? "text-secondary" : "text-error"}`}>
              {entry.ownScore}-{entry.opponentScore}
            </p>
          </div>
        ))}
      </Card>
    </main>
  );
}
