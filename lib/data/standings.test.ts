import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStandings } from "./standings";

describe("getStandings", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("computes wins, matches played, and win percentage per player", async () => {
    const [p1] = await db.insert(players).values({ name: "__Standings Winner__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Loser__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Standings Test Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const [match] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    insertedMatchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 2 },
    ]);

    const standings = await getStandings();
    const winnerRow = standings.find((s) => s.id === p1.id);
    const loserRow = standings.find((s) => s.id === p2.id);

    expect(winnerRow).toMatchObject({ wins: 1, matchesPlayed: 1, winPercentage: 100 });
    expect(loserRow).toMatchObject({ wins: 0, matchesPlayed: 1, winPercentage: 0 });
  });

  it("filters matches by the tournament's start date", async () => {
    const [p1] = await db.insert(players).values({ name: "__Standings Date P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Date P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [oldTournament] = await db
      .insert(tournaments)
      .values({
        name: "__Old Tournament__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        startedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newTournament] = await db
      .insert(tournaments)
      .values({
        name: "__New Tournament__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        startedAt: new Date("2026-06-01T00:00:00Z"),
      })
      .returning();
    insertedTournamentIds.push(oldTournament.id, newTournament.id);

    const [oldMatch] = await db
      .insert(matches)
      .values({
        tournamentId: oldTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newMatch] = await db
      .insert(matches)
      .values({
        tournamentId: newTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date("2026-06-01T00:00:00Z"),
      })
      .returning();
    insertedMatchIds.push(oldMatch.id, newMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: oldMatch.id, playerId: p1.id, side: 1 },
      { matchId: oldMatch.id, playerId: p2.id, side: 2 },
      { matchId: newMatch.id, playerId: p1.id, side: 1 },
      { matchId: newMatch.id, playerId: p2.id, side: 2 },
    ]);

    const recentOnly = await getStandings({ from: new Date("2026-03-01T00:00:00Z") });
    const recentRow = recentOnly.find((s) => s.id === p1.id);
    expect(recentRow?.matchesPlayed).toBe(1);

    const both = await getStandings();
    const bothRow = both.find((s) => s.id === p1.id);
    expect(bothRow?.matchesPlayed).toBe(2);
  });

  it("computes losses as matchesPlayed - wins", async () => {
    // Create player with 3 wins out of 5 matches
    const [player] = await db.insert(players).values({ name: "__Standings Losses Test__" }).returning();
    const [opponent] = await db.insert(players).values({ name: "__Standings Losses Opponent__" }).returning();
    insertedPlayerIds.push(player.id, opponent.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Losses Test Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    // Create 5 matches: 3 wins, 2 losses
    const matchIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const isWin = i < 3;
      const [match] = await db
        .insert(matches)
        .values({
          tournamentId: tournament.id,
          courtNumber: 1,
          roundNumber: i + 1,
          side1Score: isWin ? 11 : 4,
          side2Score: isWin ? 4 : 11,
          status: "final",
          playedAt: new Date(),
        })
        .returning();
      matchIds.push(match.id);
    }
    insertedMatchIds.push(...matchIds);

    await db.insert(matchParticipants).values(
      matchIds.map((matchId, i) => ({
        matchId,
        playerId: player.id,
        side: 1,
      }))
    );
    await db.insert(matchParticipants).values(
      matchIds.map((matchId) => ({
        matchId,
        playerId: opponent.id,
        side: 2,
      }))
    );

    const standings = await getStandings();
    const row = standings.find((s) => s.id === player.id);

    expect(row?.wins).toBe(3);
    expect(row?.matchesPlayed).toBe(5);
    expect(row?.losses).toBe(2); // 5 - 3
  });

  it("computes point differential correctly", async () => {
    const [player] = await db.insert(players).values({ name: "__Point Diff Player__" }).returning();
    const [opponent1] = await db.insert(players).values({ name: "__Point Diff Opponent 1__" }).returning();
    const [opponent2] = await db.insert(players).values({ name: "__Point Diff Opponent 2__" }).returning();
    insertedPlayerIds.push(player.id, opponent1.id, opponent2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({
        name: "__Point Diff Test Tournament__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "singles",
      })
      .returning();
    insertedTournamentIds.push(tournament.id);

    // Match 1: player on side1 (10) vs opponent1 on side2 (8) → +2
    const [match1] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 10,
        side2Score: 8,
        status: "final",
        playedAt: new Date(),
      })
      .returning();

    // Match 2: player on side2 (7) vs opponent2 on side1 (11) → -4
    const [match2] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 2,
        side1Score: 11,
        side2Score: 7,
        status: "final",
        playedAt: new Date(),
      })
      .returning();

    // Match 3: unfinished (not counted)
    const [match3] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 3,
        side1Score: null,
        side2Score: null,
        status: "scheduled",
        playedAt: new Date(),
      })
      .returning();

    insertedMatchIds.push(match1.id, match2.id, match3.id);

    await db.insert(matchParticipants).values([
      { matchId: match1.id, playerId: player.id, side: 1 },
      { matchId: match1.id, playerId: opponent1.id, side: 2 },
      { matchId: match2.id, playerId: player.id, side: 2 },
      { matchId: match2.id, playerId: opponent2.id, side: 1 },
      { matchId: match3.id, playerId: player.id, side: 1 },
      { matchId: match3.id, playerId: opponent1.id, side: 2 },
    ]);

    const standings = await getStandings();
    const row = standings.find((s) => s.id === player.id);

    expect(row?.pointDifferential).toBe(-2); // 10-8 + 7-11 = 2 - 4 = -2
  });

  it("filters standings by match format", async () => {
    const [p1] = await db.insert(players).values({ name: "__Standings Format P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Format P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [singlesTournament] = await db
      .insert(tournaments)
      .values({ name: "__Format Singles Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    const [doublesTournament] = await db
      .insert(tournaments)
      .values({
        name: "__Format Doubles Tournament__",
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
        side2Score: 4,
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
        side2Score: 4,
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

    const singlesOnly = await getStandings(undefined, "singles");
    expect(singlesOnly.find((s) => s.id === p1.id)?.matchesPlayed).toBe(1);

    const doublesOnly = await getStandings(undefined, "doubles");
    expect(doublesOnly.find((s) => s.id === p1.id)?.matchesPlayed).toBe(1);

    const overall = await getStandings();
    expect(overall.find((s) => s.id === p1.id)?.matchesPlayed).toBe(2);
  });
});
