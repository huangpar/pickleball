import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants, tournamentParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTournamentDetail } from "./tournamentDetail";

describe("getTournamentDetail", () => {
  const insertedPlayerIds: string[] = [];
  const tournamentIds: string[] = [];
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of tournamentIds) {
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, id));
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("returns matches grouped with player names, sorted by round then court", async () => {
    const [p1] = await db.insert(players).values({ name: "__Detail P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Detail P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Detail Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);

    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 2 },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.matches).toHaveLength(1);
    expect(detail?.matches[0]).toMatchObject({
      roundNumber: 1,
      courtNumber: 1,
      status: "scheduled",
      side1PlayerNames: ["__Detail P1__"],
      side2PlayerNames: ["__Detail P2__"],
    });
  });

  it("returns null for a nonexistent tournament", async () => {
    const detail = await getTournamentDetail("00000000-0000-0000-0000-000000000000");
    expect(detail).toBeNull();
  });

  it("returns the full participant roster from tournament_participants", async () => {
    const [p1] = await db.insert(players).values({ name: "__Roster P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Roster P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Roster Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "setup" })
      .returning();
    tournamentIds.push(tournament.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournament.id, playerId: p1.id },
      { tournamentId: tournament.id, playerId: p2.id },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.participants).toHaveLength(2);
    expect(detail?.participants.map((p) => p.name).sort()).toEqual(["__Roster P1__", "__Roster P2__"]);
    expect(detail?.byes).toEqual([]);
  });

  it("computes byes for roster participants without a match in a round", async () => {
    const [p1] = await db.insert(players).values({ name: "__Bye P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Bye P2__" }).returning();
    const [p3] = await db.insert(players).values({ name: "__Bye P3__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id, p3.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Bye Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournament.id, playerId: p1.id },
      { tournamentId: tournament.id, playerId: p2.id },
      { tournamentId: tournament.id, playerId: p3.id },
    ]);

    // Round-robin for 3 players: round1 p1v p2 (bye p3), round2 p1v p3 (bye p2), round3 p2v p3 (bye p1)
    const [matchRound1] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    const [matchRound2] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 2, status: "scheduled" })
      .returning();
    const [matchRound3] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 3, status: "scheduled" })
      .returning();
    matchIds.push(matchRound1.id, matchRound2.id, matchRound3.id);

    await db.insert(matchParticipants).values([
      { matchId: matchRound1.id, playerId: p1.id, side: 1 },
      { matchId: matchRound1.id, playerId: p2.id, side: 2 },
      { matchId: matchRound2.id, playerId: p1.id, side: 1 },
      { matchId: matchRound2.id, playerId: p3.id, side: 2 },
      { matchId: matchRound3.id, playerId: p2.id, side: 1 },
      { matchId: matchRound3.id, playerId: p3.id, side: 2 },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.byes).toEqual([
      { roundNumber: 1, playerNames: ["__Bye P3__"] },
      { roundNumber: 2, playerNames: ["__Bye P2__"] },
      { roundNumber: 3, playerNames: ["__Bye P1__"] },
    ]);
  });

  it("resolves firstServerName from the match's firstServerId, or null when not set", async () => {
    const [p1] = await db.insert(players).values({ name: "__Server P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Server P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Server Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);

    const [matchWithServer] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled", firstServerId: p1.id })
      .returning();
    const [matchWithoutServer] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 2, status: "scheduled" })
      .returning();
    matchIds.push(matchWithServer.id, matchWithoutServer.id);

    await db.insert(matchParticipants).values([
      { matchId: matchWithServer.id, playerId: p1.id, side: 1 },
      { matchId: matchWithServer.id, playerId: p2.id, side: 2 },
      { matchId: matchWithoutServer.id, playerId: p1.id, side: 1 },
      { matchId: matchWithoutServer.id, playerId: p2.id, side: 2 },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    const withServer = detail?.matches.find((m) => m.id === matchWithServer.id);
    const withoutServer = detail?.matches.find((m) => m.id === matchWithoutServer.id);
    expect(withServer?.firstServerName).toBe("__Server P1__");
    expect(withoutServer?.firstServerName).toBeNull();
  });
});
