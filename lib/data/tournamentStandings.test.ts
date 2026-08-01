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
    const [p1] = await db.insert(players).values({ name: "__TStandings P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__TStandings P2__" }).returning();
    const [p3] = await db.insert(players).values({ name: "__TStandings P3__" }).returning();
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

  it("computes losses and pointDifferential scoped to tournament", async () => {
    const [player] = await db.insert(players).values({ name: "__TStandings PD Player__" }).returning();
    insertedPlayerIds.push(player.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__TStandings PD Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    const [otherTournament] = await db
      .insert(tournaments)
      .values({ name: "__TStandings PD Other__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id, otherTournament.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournament.id, playerId: player.id },
      { tournamentId: otherTournament.id, playerId: player.id },
    ]);

    // Create matches in this tournament and another
    const [match1] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        status: "final",
        side1Score: 10,
        side2Score: 8,
        playedAt: new Date(),
      })
      .returning();
    const [match2] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 2,
        status: "final",
        side1Score: 7,
        side2Score: 11,
        playedAt: new Date(),
      })
      .returning();
    const [match3] = await db
      .insert(matches)
      .values({
        tournamentId: otherTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        status: "final",
        side1Score: 15,
        side2Score: 5,
        playedAt: new Date(),
      })
      .returning();
    matchIds.push(match1.id, match2.id, match3.id);

    await db.insert(matchParticipants).values([
      { matchId: match1.id, playerId: player.id, side: 1 },
      { matchId: match2.id, playerId: player.id, side: 1 },
      { matchId: match3.id, playerId: player.id, side: 1 },
    ]);

    const standings = await getTournamentStandings(tournament.id);
    const row = standings.find((s) => s.id === player.id);

    // Only matches 1 & 2 should be counted
    expect(row?.wins).toBe(1);
    expect(row?.losses).toBe(1);
    expect(row?.matchesPlayed).toBe(2);
    expect(row?.pointDifferential).toBe(-2); // 10-8 + 7-11 = -2 (match3 excluded)
  });
});
