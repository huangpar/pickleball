// lib/data/tournamentStandings.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants, tournamentParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTournamentStandings } from "./tournamentDetail";

describe("getTournamentStandings", () => {
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

  it("only counts matches from the requested tournament, even for a player who played in two", async () => {
    const [p1] = await db.insert(players).values({ name: "__TStandings P1__", duprRating: "4.50" }).returning();
    const [p2] = await db.insert(players).values({ name: "__TStandings P2__", duprRating: "4.00" }).returning();
    const [p3] = await db.insert(players).values({ name: "__TStandings P3__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id, p3.id);

    const [tournamentA] = await db
      .insert(tournaments)
      .values({ name: "__TStandings Tournament A__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    const [tournamentB] = await db
      .insert(tournaments)
      .values({ name: "__TStandings Tournament B__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournamentA.id, tournamentB.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournamentA.id, playerId: p1.id },
      { tournamentId: tournamentA.id, playerId: p2.id },
      { tournamentId: tournamentB.id, playerId: p1.id },
      { tournamentId: tournamentB.id, playerId: p3.id },
    ]);

    const [matchInA] = await db
      .insert(matches)
      .values({
        tournamentId: tournamentA.id,
        courtNumber: 1,
        roundNumber: 1,
        status: "final",
        side1Score: 11,
        side2Score: 5,
        playedAt: new Date(),
      })
      .returning();
    const [matchInB] = await db
      .insert(matches)
      .values({
        tournamentId: tournamentB.id,
        courtNumber: 1,
        roundNumber: 1,
        status: "final",
        side1Score: 3,
        side2Score: 11,
        playedAt: new Date(),
      })
      .returning();
    matchIds.push(matchInA.id, matchInB.id);

    await db.insert(matchParticipants).values([
      { matchId: matchInA.id, playerId: p1.id, side: 1 }, // p1 wins in A
      { matchId: matchInA.id, playerId: p2.id, side: 2 },
      { matchId: matchInB.id, playerId: p1.id, side: 1 }, // p1 loses in B
      { matchId: matchInB.id, playerId: p3.id, side: 2 },
    ]);

    const standingsA = await getTournamentStandings(tournamentA.id);
    expect(standingsA).toHaveLength(2);
    const p1RowInA = standingsA.find((s) => s.id === p1.id);
    expect(p1RowInA).toMatchObject({ wins: 1, matchesPlayed: 1, winPercentage: 100 });
    const p2Row = standingsA.find((s) => s.id === p2.id);
    expect(p2Row).toMatchObject({ wins: 0, matchesPlayed: 1, winPercentage: 0 });
  });

  it("returns an empty array for a tournament with no participants", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__TStandings Empty__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "setup" })
      .returning();
    tournamentIds.push(tournament.id);

    const standings = await getTournamentStandings(tournament.id);
    expect(standings).toEqual([]);
  });
});
