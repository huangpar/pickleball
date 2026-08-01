import { db } from "@/lib/db/client";
import { players, matches, matchParticipants, tournaments } from "@/lib/db/schema";
import { eq, and, gte, lte, type SQL } from "drizzle-orm";
import type { MatchOutcome } from "@/lib/stats";

export interface PlayerRow {
  id: string;
  name: string;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface PlayerMatchOutcome {
  matchId: string;
  playedAt: Date;
  side: number;
  won: boolean;
  match: {
    status: "final" | "scheduled";
    side1Score: number | null;
    side2Score: number | null;
  };
}

export async function getAllPlayers(): Promise<PlayerRow[]> {
  return db.select({ id: players.id, name: players.name }).from(players);
}

export async function getPlayerById(id: string): Promise<PlayerRow | null> {
  const rows = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.id, id));
  return rows[0] ?? null;
}

export async function getPlayerMatchOutcomes(playerId: string, dateRange?: DateRange): Promise<PlayerMatchOutcome[]> {
  const conditions: SQL[] = [eq(matchParticipants.playerId, playerId), eq(matches.status, "final")];
  if (dateRange?.from) conditions.push(gte(tournaments.startedAt, dateRange.from));
  if (dateRange?.to) conditions.push(lte(tournaments.startedAt, dateRange.to));

  const rows = await db
    .select({
      matchId: matches.id,
      side: matchParticipants.side,
      status: matches.status,
      side1Score: matches.side1Score,
      side2Score: matches.side2Score,
      playedAt: matches.playedAt,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(and(...conditions));

  return rows
    .filter((r) => r.playedAt !== null && r.side1Score !== null && r.side2Score !== null)
    .sort((a, b) => a.playedAt!.getTime() - b.playedAt!.getTime())
    .map((r) => {
      const ownScore = r.side === 1 ? r.side1Score! : r.side2Score!;
      const otherScore = r.side === 1 ? r.side2Score! : r.side1Score!;
      return {
        matchId: r.matchId,
        playedAt: r.playedAt!,
        side: r.side,
        won: ownScore > otherScore,
        match: {
          status: "final" as const,
          side1Score: r.side1Score!,
          side2Score: r.side2Score!,
        },
      };
    });
}
