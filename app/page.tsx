import {
  getDashboardStats,
  getMatchActivityLast7Days,
  getRecentMatches,
  getUpcomingMatches,
  getTopPerformer,
} from "@/lib/data/dashboard";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { ActivityChart } from "@/components/dashboard/ActivityChart";

export default async function DashboardPage() {
  const [stats, activity, recentMatches, upcomingMatches, topPerformer] = await Promise.all([
    getDashboardStats(),
    getMatchActivityLast7Days(),
    getRecentMatches(),
    getUpcomingMatches(),
    getTopPerformer(),
  ]);

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <h1 className="font-headline text-3xl font-bold">League Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active Players" value={String(stats.activePlayers)} />
        <StatCard label="Ongoing Matches" value={String(stats.ongoingMatches)} />
        <StatCard label="Avg. Match Time" value={`${stats.avgMatchDurationMinutes}m`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="font-headline text-lg font-semibold mb-4">Match Activity Pulse</h2>
          <ActivityChart data={activity} />
        </Card>

        <Card className="bg-primary text-on-primary">
          <p className="font-mono text-xs uppercase tracking-wide opacity-70">Top Performer</p>
          {topPerformer ? (
            <>
              <div className="flex items-center gap-3 mt-3">
                <Avatar name={topPerformer.name} />
                <p className="font-headline text-lg font-bold">{topPerformer.name}</p>
              </div>
              <p className="font-mono text-sm mt-2">{topPerformer.winPercentage}% win rate</p>
            </>
          ) : (
            <p className="mt-3 text-sm opacity-70">Not enough matches played yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-6 pb-0">Recent Matches</h2>
          {recentMatches.length === 0 && <p className="p-6 text-on-surface-variant">No matches played yet.</p>}
          {recentMatches.map((m) => (
            <div key={m.matchId} className="flex items-center justify-between p-4">
              <p className="font-body text-sm">
                {m.side1PlayerNames.join(" & ")} vs. {m.side2PlayerNames.join(" & ")}
              </p>
              <p className="font-mono text-sm font-semibold">
                {m.side1Score}-{m.side2Score}
              </p>
            </div>
          ))}
        </Card>

        <Card className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-6 pb-0">Upcoming Matches</h2>
          {upcomingMatches.length === 0 && <p className="p-6 text-on-surface-variant">No scheduled matches.</p>}
          {upcomingMatches.map((m) => (
            <div key={m.matchId} className="flex items-center justify-between p-4">
              <p className="font-body text-sm">
                {m.side1PlayerNames.join(" & ")} vs. {m.side2PlayerNames.join(" & ")}
              </p>
              <p className="font-mono text-xs text-on-surface-variant">{m.tournamentName}</p>
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
