import { describe, it, expect, afterAll } from "vitest";
import { db } from "./client";
import { players } from "./schema";
import { eq } from "drizzle-orm";

describe("db smoke test", () => {
  const testName = "__smoke_test_player__";

  afterAll(async () => {
    await db.delete(players).where(eq(players.name, testName));
  });

  it("inserts and reads back a player", async () => {
    const [inserted] = await db
      .insert(players)
      .values({ name: testName, duprRating: "3.50" })
      .returning();
    expect(inserted.name).toBe(testName);

    const rows = await db.select().from(players).where(eq(players.name, testName));
    expect(rows).toHaveLength(1);
    expect(rows[0].duprRating).toBe("3.50");
  });
});
