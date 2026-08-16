import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAllPlayers, getPlayerById, getPlayerMatchOutcomes } from "./players";

describe("players data layer", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) {
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) {
      await db.delete(players).where(eq(players.id, id));
    }
  });

  it("getAllPlayers and getPlayerById return inserted players", async () => {
    const [p1] = await db.insert(players).values({ name: "__Test Player One__" }).returning();
    insertedPlayerIds.push(p1.id);

    const all = await getAllPlayers();
    expect(all.some((p) => p.id === p1.id)).toBe(true);

    const fetched = await getPlayerById(p1.id);
    expect(fetched?.name).toBe("__Test Player One__");
  });

  it("getAllPlayers returns players sorted alphabetically by name", async () => {
    const [pz] = await db.insert(players).values({ name: "__ZZZ Alpha Test__" }).returning();
    const [pa] = await db.insert(players).values({ name: "__AAA Alpha Test__" }).returning();
    const [pm] = await db.insert(players).values({ name: "__MMM Alpha Test__" }).returning();
    insertedPlayerIds.push(pz.id, pa.id, pm.id);

    const all = await getAllPlayers();
    const testNames = all.map((p) => p.name).filter((name) => name.includes("Alpha Test"));
    expect(testNames).toEqual(["__AAA Alpha Test__", "__MMM Alpha Test__", "__ZZZ Alpha Test__"]);
  });

  it("getPlayerMatchOutcomes filters by tournament match format when specified", async () => {
    const [p1] = await db.insert(players).values({ name: "__Format Filter P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Format Filter P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [singlesTournament] = await db
      .insert(tournaments)
      .values({ name: "__Format Filter Singles__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    const [doublesTournament] = await db
      .insert(tournaments)
      .values({
        name: "__Format Filter Doubles__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "doubles",
        teamMode: "fixed",
      })
      .returning();
    insertedTournamentIds.push(singlesTournament.id, doublesTournament.id);

    const [singlesMatch] = await db
      .insert(matches)
      .values({
        tournamentId: singlesTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 5,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    const [doublesMatch] = await db
      .insert(matches)
      .values({
        tournamentId: doublesTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 5,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    insertedMatchIds.push(singlesMatch.id, doublesMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: singlesMatch.id, playerId: p1.id, side: 1 },
      { matchId: singlesMatch.id, playerId: p2.id, side: 2 },
      { matchId: doublesMatch.id, playerId: p1.id, side: 1 },
      { matchId: doublesMatch.id, playerId: p2.id, side: 2 },
    ]);

    const singlesOnly = await getPlayerMatchOutcomes(p1.id, undefined, "singles");
    expect(singlesOnly).toHaveLength(1);
    expect(singlesOnly[0].matchId).toBe(singlesMatch.id);

    const all = await getPlayerMatchOutcomes(p1.id);
    expect(all).toHaveLength(2);
  });

  it("getPlayerMatchOutcomes returns only final matches, sorted ascending, with correct win/loss", async () => {
    const [p1] = await db.insert(players).values({ name: "__Test Player Two__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Test Player Three__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Test Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-02-01T00:00:00Z");

    const [match1] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 5,
        status: "final",
        playedAt: newer,
      })
      .returning();
    const [match2] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 2,
        side1Score: 3,
        side2Score: 11,
        status: "final",
        playedAt: older,
      })
      .returning();
    const [scheduledMatch] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 3, status: "scheduled" })
      .returning();
    insertedMatchIds.push(match1.id, match2.id, scheduledMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: match1.id, playerId: p1.id, side: 1 },
      { matchId: match1.id, playerId: p2.id, side: 2 },
      { matchId: match2.id, playerId: p1.id, side: 1 },
      { matchId: match2.id, playerId: p2.id, side: 2 },
      { matchId: scheduledMatch.id, playerId: p1.id, side: 1 },
    ]);

    const outcomes = await getPlayerMatchOutcomes(p1.id);
    expect(outcomes).toHaveLength(2); // scheduled match excluded
    expect(outcomes[0].matchId).toBe(match2.id); // older match first
    expect(outcomes[0].won).toBe(false); // 3-11
    expect(outcomes[1].matchId).toBe(match1.id);
    expect(outcomes[1].won).toBe(true); // 11-5
  });
});
