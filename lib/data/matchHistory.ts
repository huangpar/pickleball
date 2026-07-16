import { db } from "@/lib/db/client";
import { matches, matchParticipants, players, tournaments } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface MatchHistoryEntry {
  matchId: string;
  tournamentName: string;
  playedAt: Date;
  ownScore: number;
  opponentScore: number;
  won: boolean;
  partnerNames: string[];
  opponentNames: string[];
}

export async function getPlayerMatchHistory(playerId: string): Promise<MatchHistoryEntry[]> {
  const ownRows = await db
    .select({
      matchId: matches.id,
      tournamentName: tournaments.name,
      playedAt: matches.playedAt,
      side: matchParticipants.side,
      side1Score: matches.side1Score,
      side2Score: matches.side2Score,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(and(eq(matchParticipants.playerId, playerId), eq(matches.status, "final")));

  const finalRows = ownRows.filter((r) => r.playedAt !== null && r.side1Score !== null && r.side2Score !== null);
  if (finalRows.length === 0) return [];

  const matchIds = finalRows.map((r) => r.matchId);
  const allParticipants = await db
    .select({
      matchId: matchParticipants.matchId,
      playerId: matchParticipants.playerId,
      side: matchParticipants.side,
      name: players.name,
    })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { playerId: string; side: number; name: string }[]>();
  for (const p of allParticipants) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  return finalRows
    .map((r) => {
      const ownScore = r.side === 1 ? r.side1Score! : r.side2Score!;
      const opponentScore = r.side === 1 ? r.side2Score! : r.side1Score!;
      const participants = participantsByMatch.get(r.matchId) ?? [];
      const partnerNames = participants.filter((p) => p.side === r.side && p.playerId !== playerId).map((p) => p.name);
      const opponentNames = participants.filter((p) => p.side !== r.side).map((p) => p.name);

      return {
        matchId: r.matchId,
        tournamentName: r.tournamentName,
        playedAt: r.playedAt as Date,
        ownScore,
        opponentScore,
        won: ownScore > opponentScore,
        partnerNames,
        opponentNames,
      };
    })
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
}
