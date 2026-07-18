import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import type { StandingRow } from "@/lib/standings";

export function TournamentStandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <p className="text-on-surface-variant">No standings yet.</p>;
  }

  return (
    <>
      <Card className="p-0 hidden md:block" data-testid="tournament-standings-table">
        <table className="w-full">
          <thead>
            <tr className="text-left font-mono text-xs text-on-surface-variant uppercase border-b border-surface-container-high">
              <th className="p-4">Rank</th>
              <th className="p-4">Player</th>
              <th className="p-4">Wins</th>
              <th className="p-4">Win %</th>
              <th className="p-4">Matches</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.id} className="border-b border-surface-container-high last:border-0">
                <td className="p-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name} size="sm" />
                    {row.name}
                  </div>
                </td>
                <td className="p-4">{row.wins}</td>
                <td className="p-4">{row.winPercentage}%</td>
                <td className="p-4">{row.matchesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 md:hidden divide-y divide-surface-container-high" data-testid="tournament-standings-cards">
        {standings.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
              <Avatar name={row.name} size="sm" />
              <p className="font-body font-medium">{row.name}</p>
            </div>
            <div className="text-right">
              <p className="font-headline font-bold">{row.wins}W</p>
              <p className="font-mono text-xs text-on-surface-variant">
                {row.winPercentage}% &middot; {row.matchesPlayed}m
              </p>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
