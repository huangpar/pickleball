import { db } from "@/lib/db/client";
import { tournaments, matches, matchParticipants, players } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface MatchDetail {
  id: string;
  roundNumber: number;
  courtNumber: number;
  status: "scheduled" | "final";
  side1Score: number | null;
  side2Score: number | null;
  side1PlayerNames: string[];
  side2PlayerNames: string[];
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  matches: MatchDetail[];
}

export async function getTournamentDetail(tournamentId: string): Promise<TournamentDetail | null> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return null;

  const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
  const base = { id: tournament.id, name: tournament.name, status: tournament.status, matchFormat: tournament.matchFormat };
  if (matchRows.length === 0) return { ...base, matches: [] };

  const matchIds = matchRows.map((m) => m.id);
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

  const matchDetails: MatchDetail[] = matchRows
    .map((m) => {
      const participants = participantsByMatch.get(m.id) ?? [];
      return {
        id: m.id,
        roundNumber: m.roundNumber,
        courtNumber: m.courtNumber,
        status: m.status,
        side1Score: m.side1Score,
        side2Score: m.side2Score,
        side1PlayerNames: participants.filter((p) => p.side === 1).map((p) => p.name),
        side2PlayerNames: participants.filter((p) => p.side === 2).map((p) => p.name),
      };
    })
    .sort((a, b) => a.roundNumber - b.roundNumber || a.courtNumber - b.courtNumber);

  return { ...base, matches: matchDetails };
}
