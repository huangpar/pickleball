"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { sortStandings, type StandingRow, type StandingsSort } from "@/lib/standings";

const PLACE_LABELS = ["1st Place", "2nd Place", "3rd Place"];

export function StandingsTable({ initialStandings }: { initialStandings: StandingRow[] }) {
  const [sortBy, setSortBy] = useState<StandingsSort>("wins");
  const sorted = useMemo(() => sortStandings(initialStandings, sortBy), [initialStandings, sortBy]);
  const top3 = sorted.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("wins")}
            className={`px-3 py-1.5 rounded text-sm font-body ${
              sortBy === "wins" ? "bg-secondary text-on-secondary" : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            Wins
          </button>
          <button
            onClick={() => setSortBy("winPercentage")}
            className={`px-3 py-1.5 rounded text-sm font-body ${
              sortBy === "winPercentage" ? "bg-secondary text-on-secondary" : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            Win %
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((row, i) => (
          <Card key={row.id}>
            <Avatar name={row.name} />
            <p className="font-headline text-lg font-bold mt-2">{row.name}</p>
            <p className="font-mono text-xs text-on-surface-variant uppercase">{PLACE_LABELS[i]}</p>
            <div className="flex gap-6 mt-3">
              <div>
                <p className="font-mono text-xs text-on-surface-variant">WINS</p>
                <p className="font-headline text-xl font-bold">{row.wins}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-on-surface-variant">WIN %</p>
                <p className="font-headline text-xl font-bold">{row.winPercentage}%</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-0 hidden md:block" data-testid="standings-table">
        <table className="w-full">
          <thead>
            <tr className="text-left font-mono text-xs text-on-surface-variant uppercase border-b border-surface-container-high">
              <th className="p-4">Rank</th>
              <th className="p-4">Player</th>
              <th className="p-4">DUPR</th>
              <th className="p-4">Wins</th>
              <th className="p-4">Win %</th>
              <th className="p-4">Matches</th>
              <th className="p-4">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.id} className="border-b border-surface-container-high last:border-0">
                <td className="p-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name} size="sm" />
                    {row.name}
                  </div>
                </td>
                <td className="p-4 font-mono">{row.duprRating}</td>
                <td className="p-4">{row.wins}</td>
                <td className="p-4">{row.winPercentage}%</td>
                <td className="p-4">{row.matchesPlayed}</td>
                <td className="p-4">{row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 md:hidden divide-y divide-surface-container-high" data-testid="standings-cards">
        {sorted.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
              <Avatar name={row.name} size="sm" />
              <div>
                <p className="font-body font-medium">{row.name}</p>
                <p className="font-mono text-xs text-on-surface-variant">
                  {row.duprRating} DUPR &middot; {row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}
                </p>
              </div>
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
    </div>
  );
}
