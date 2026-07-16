import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq, sql, and, gte, desc, asc, inArray } from "drizzle-orm";
import { getStandings } from "./standings";

export interface DashboardStats {
  activePlayers: number;
  ongoingMatches: number;
  avgMatchDurationMinutes: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [{ count: activePlayers }] = await db.select({ count: sql<number>`count(*)::int` }).from(players);
  const [{ count: ongoingMatches }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(eq(matches.status, "scheduled"));
  const [{ avg }] = await db
    .select({ avg: sql<number | null>`avg(${tournaments.matchDurationMinutes})` })
    .from(tournaments);

  return {
    activePlayers,
    ongoingMatches,
    avgMatchDurationMinutes: avg ? Math.round(Number(avg)) : 0,
  };
}

export interface DailyActivity {
  date: string;
  count: number;
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getMatchActivityLast7Days(): Promise<DailyActivity[]> {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ playedAt: matches.playedAt })
    .from(matches)
    .where(and(eq(matches.status, "final"), gte(matches.playedAt, start)));

  const countsByDate = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    countsByDate.set(toLocalDateKey(d), 0);
  }
  for (const row of rows) {
    if (!row.playedAt) continue;
    const key = toLocalDateKey(row.playedAt);
    if (countsByDate.has(key)) {
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }
  }

  return [...countsByDate.entries()].map(([date, count]) => ({ date, count }));
}

export interface DashboardMatch {
  matchId: string;
  tournamentName: string;
  side1PlayerNames: string[];
  side2PlayerNames: string[];
  side1Score: number | null;
  side2Score: number | null;
  status: "scheduled" | "final";
}

async function getMatchesByStatus(status: "scheduled" | "final", limit: number): Promise<DashboardMatch[]> {
  const rows = await db
    .select({
      matchId: matches.id,
      tournamentName: tournaments.name,
      side1Score: matches.side1Score,
      side2Score: matches.side2Score,
      status: matches.status,
    })
    .from(matches)
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(matches.status, status))
    .orderBy(status === "final" ? desc(matches.playedAt) : asc(matches.roundNumber))
    .limit(limit);

  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.matchId);
  const participantRows = await db
    .select({ matchId: matchParticipants.matchId, side: matchParticipants.side, name: players.name })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { side: number; name: string }[]>();
  for (const p of participantRows) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  return rows.map((r) => {
    const participants = participantsByMatch.get(r.matchId) ?? [];
    return {
      matchId: r.matchId,
      tournamentName: r.tournamentName,
      side1PlayerNames: participants.filter((p) => p.side === 1).map((p) => p.name),
      side2PlayerNames: participants.filter((p) => p.side === 2).map((p) => p.name),
      side1Score: r.side1Score,
      side2Score: r.side2Score,
      status: r.status,
    };
  });
}

export async function getRecentMatches(limit = 5): Promise<DashboardMatch[]> {
  return getMatchesByStatus("final", limit);
}

export async function getUpcomingMatches(limit = 5): Promise<DashboardMatch[]> {
  return getMatchesByStatus("scheduled", limit);
}

export interface TopPerformer {
  id: string;
  name: string;
  winPercentage: number;
}

export async function getTopPerformer(minMatches = 3): Promise<TopPerformer | null> {
  const standings = await getStandings();
  const eligible = standings.filter((s) => s.matchesPlayed >= minMatches);
  if (eligible.length === 0) return null;

  const [top] = [...eligible].sort((a, b) => b.winPercentage - a.winPercentage);
  return { id: top.id, name: top.name, winPercentage: top.winPercentage };
}
