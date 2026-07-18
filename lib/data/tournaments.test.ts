import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, tournamentParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAllTournaments } from "./tournaments";

describe("getAllTournaments", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedTournamentIds) {
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, id));
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("returns participant counts and orders newest first", async () => {
    const [p1] = await db.insert(players).values({ name: "__Tournaments P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Tournaments P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [older] = await db
      .insert(tournaments)
      .values({
        name: "__Older Tournament__",
        numCourts: 2,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newer] = await db
      .insert(tournaments)
      .values({
        name: "__Newer Tournament__",
        numCourts: 2,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      })
      .returning();
    insertedTournamentIds.push(older.id, newer.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: newer.id, playerId: p1.id },
      { tournamentId: newer.id, playerId: p2.id },
    ]);

    const all = await getAllTournaments();
    const newerRow = all.find((t) => t.id === newer.id);
    const olderRow = all.find((t) => t.id === older.id);

    expect(newerRow?.participantCount).toBe(2);
    expect(olderRow?.participantCount).toBe(0);
    expect(all.findIndex((t) => t.id === newer.id)).toBeLessThan(all.findIndex((t) => t.id === older.id));
  });
});
