import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlayerPartnerBreakdown } from "./partnerBreakdown";

describe("getPlayerPartnerBreakdown", () => {
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

  async function insertPlayers(names: string[]) {
    const inserted = [];
    for (const name of names) {
      const [p] = await db.insert(players).values({ name }).returning();
      inserted.push(p);
    }
    insertedPlayerIds.push(...inserted.map((p) => p.id));
    return inserted;
  }

  async function insertDoublesTournament(name: string) {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name, numCourts: 1, matchDurationMinutes: 30, matchFormat: "doubles", teamMode: "fixed" })
      .returning();
    insertedTournamentIds.push(tournament.id);
    return tournament;
  }

  async function insertFinalMatch(
    tournamentId: string,
    side1: { id: string }[],
    side2: { id: string }[],
    side1Score: number,
    side2Score: number
  ) {
    const [match] = await db
      .insert(matches)
      .values({ tournamentId, courtNumber: 1, roundNumber: 1, side1Score, side2Score, status: "final", playedAt: new Date() })
      .returning();
    insertedMatchIds.push(match.id);
    await db.insert(matchParticipants).values([
      ...side1.map((p) => ({ matchId: match.id, playerId: p.id, side: 1 })),
      ...side2.map((p) => ({ matchId: match.id, playerId: p.id, side: 2 })),
    ]);
    return match;
  }

  it("accumulates wins and losses against the same opponent team across repeated matchups", async () => {
    const [p1, p2, p3, p4] = await insertPlayers([
      "__Breakdown P1__",
      "__Breakdown P2__",
      "__Breakdown P3__",
      "__Breakdown P4__",
    ]);
    const tournament = await insertDoublesTournament("__Breakdown Tournament 1__");

    await insertFinalMatch(tournament.id, [p1, p2], [p3, p4], 11, 7);
    await insertFinalMatch(tournament.id, [p1, p2], [p3, p4], 9, 11);

    const breakdown = await getPlayerPartnerBreakdown(p1.id);
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toMatchObject({
      partnerName: "__Breakdown P2__",
      wins: 1,
      losses: 1,
      winPercentage: 50,
    });
    expect(breakdown[0].opponents).toHaveLength(1);
    expect(breakdown[0].opponents[0]).toMatchObject({ wins: 1, losses: 1 });
    expect(new Set(breakdown[0].opponents[0].opponentNames)).toEqual(
      new Set(["__Breakdown P3__", "__Breakdown P4__"])
    );
  });

  it("splits the breakdown by opponent team when the same partner faces different opponents", async () => {
    const [p1, p2, p3, p4, p5, p6] = await insertPlayers([
      "__Breakdown2 P1__",
      "__Breakdown2 P2__",
      "__Breakdown2 P3__",
      "__Breakdown2 P4__",
      "__Breakdown2 P5__",
      "__Breakdown2 P6__",
    ]);
    const tournament = await insertDoublesTournament("__Breakdown Tournament 2__");

    await insertFinalMatch(tournament.id, [p1, p2], [p3, p4], 11, 5);
    await insertFinalMatch(tournament.id, [p1, p2], [p5, p6], 6, 11);

    const breakdown = await getPlayerPartnerBreakdown(p1.id);
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].partnerName).toBe("__Breakdown2 P2__");
    expect(breakdown[0].wins).toBe(1);
    expect(breakdown[0].losses).toBe(1);
    expect(breakdown[0].opponents).toHaveLength(2);

    const vsP3P4 = breakdown[0].opponents.find((o) => o.opponentNames.includes("__Breakdown2 P3__"));
    const vsP5P6 = breakdown[0].opponents.find((o) => o.opponentNames.includes("__Breakdown2 P5__"));
    expect(vsP3P4).toMatchObject({ wins: 1, losses: 0 });
    expect(vsP5P6).toMatchObject({ wins: 0, losses: 1 });
  });

  it("groups by partner separately when a player has had more than one doubles partner", async () => {
    const [p1, p2, p3, p4, p5] = await insertPlayers([
      "__Breakdown3 P1__",
      "__Breakdown3 P2__",
      "__Breakdown3 P3__",
      "__Breakdown3 P4__",
      "__Breakdown3 P5__",
    ]);
    const tournament = await insertDoublesTournament("__Breakdown Tournament 3__");

    await insertFinalMatch(tournament.id, [p1, p2], [p3, p4], 11, 3);
    await insertFinalMatch(tournament.id, [p1, p5], [p3, p4], 4, 11);

    const breakdown = await getPlayerPartnerBreakdown(p1.id);
    expect(breakdown).toHaveLength(2);
    const withP2 = breakdown.find((b) => b.partnerName === "__Breakdown3 P2__");
    const withP5 = breakdown.find((b) => b.partnerName === "__Breakdown3 P5__");
    expect(withP2).toMatchObject({ wins: 1, losses: 0 });
    expect(withP5).toMatchObject({ wins: 0, losses: 1 });
  });

  it("returns an empty array for a player with no doubles history", async () => {
    const [p1, p2] = await insertPlayers(["__Breakdown4 P1__", "__Breakdown4 P2__"]);
    const [singlesTournament] = await db
      .insert(tournaments)
      .values({ name: "__Breakdown Singles Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(singlesTournament.id);

    await insertFinalMatch(singlesTournament.id, [p1], [p2], 11, 4);

    const breakdown = await getPlayerPartnerBreakdown(p1.id);
    expect(breakdown).toEqual([]);
  });
});
