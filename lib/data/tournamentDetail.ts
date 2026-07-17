import { db } from "@/lib/db/client";
import { tournaments, matches, matchParticipants, players, tournamentParticipants } from "@/lib/db/schema";
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

export interface RoundBye {
  roundNumber: number;
  playerNames: string[];
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  matches: MatchDetail[];
  participants: { id: string; name: string }[];
  byes: RoundBye[];
}

export interface TournamentParticipant {
  id: string;
  name: string;
  duprRating: string;
}

export async function getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  return db
    .select({ id: players.id, name: players.name, duprRating: players.duprRating })
    .from(tournamentParticipants)
    .innerJoin(players, eq(tournamentParticipants.playerId, players.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId));
}

export async function getTournamentDetail(tournamentId: string): Promise<TournamentDetail | null> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return null;

  const participants = await getTournamentParticipants(tournamentId);
  const base = {
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    matchFormat: tournament.matchFormat,
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
  };

  const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
  if (matchRows.length === 0) return { ...base, matches: [], byes: [] };

  const matchIds = matchRows.map((m) => m.id);
  const participantRows = await db
    .select({
      matchId: matchParticipants.matchId,
      side: matchParticipants.side,
      playerId: matchParticipants.playerId,
      name: players.name,
    })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { side: number; playerId: string; name: string }[]>();
  for (const p of participantRows) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  const matchDetails: MatchDetail[] = matchRows
    .map((m) => {
      const participantsInMatch = participantsByMatch.get(m.id) ?? [];
      return {
        id: m.id,
        roundNumber: m.roundNumber,
        courtNumber: m.courtNumber,
        status: m.status,
        side1Score: m.side1Score,
        side2Score: m.side2Score,
        side1PlayerNames: participantsInMatch.filter((p) => p.side === 1).map((p) => p.name),
        side2PlayerNames: participantsInMatch.filter((p) => p.side === 2).map((p) => p.name),
      };
    })
    .sort((a, b) => a.roundNumber - b.roundNumber || a.courtNumber - b.courtNumber);

  const playingIdsByRound = new Map<number, Set<string>>();
  for (const m of matchRows) {
    const set = playingIdsByRound.get(m.roundNumber) ?? new Set<string>();
    for (const p of participantsByMatch.get(m.id) ?? []) {
      set.add(p.playerId);
    }
    playingIdsByRound.set(m.roundNumber, set);
  }

  const byes: RoundBye[] = [...playingIdsByRound.entries()]
    .map(([roundNumber, playingIds]) => ({
      roundNumber,
      playerNames: participants.filter((p) => !playingIds.has(p.id)).map((p) => p.name),
    }))
    .filter((b) => b.playerNames.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  return { ...base, matches: matchDetails, byes };
}
