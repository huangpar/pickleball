import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import type { StandingRow } from "@/lib/standings";

export function TournamentStandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <p className="text-on-surface-variant">No standings yet.</p>;
  }

  return (
    <Card className="p-0">
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
  );
}
