"use server";

import { db } from "@/lib/db/client";
import { matches, tournaments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function recordScore(matchId: string, formData: FormData): Promise<void> {
  const side1Score = Number(formData.get("side1Score"));
  const side2Score = Number(formData.get("side2Score"));

  if (!Number.isInteger(side1Score) || side1Score < 0) {
    throw new Error("Side 1 score must be a non-negative whole number");
  }
  if (!Number.isInteger(side2Score) || side2Score < 0) {
    throw new Error("Side 2 score must be a non-negative whole number");
  }
  if (side1Score === side2Score) {
    throw new Error("Scores cannot be tied");
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) throw new Error("Match not found");

  await db
    .update(matches)
    .set({ side1Score, side2Score, status: "final", playedAt: new Date() })
    .where(eq(matches.id, matchId));

  const stillScheduled = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.tournamentId, match.tournamentId), eq(matches.status, "scheduled")));

  if (stillScheduled.length === 0) {
    await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, match.tournamentId));
  } else {
    await db
      .update(tournaments)
      .set({ status: "in_progress" })
      .where(and(eq(tournaments.id, match.tournamentId), eq(tournaments.status, "scheduled")));
  }

  safeRevalidatePath(`/tournaments/${match.tournamentId}`);
  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");
}

// `revalidatePath` requires an active Next.js request-scoped store and throws
// "Invariant: static generation store missing" when called outside one (e.g.
// invoking this server action directly from a Vitest test, rather than through
// a real Next.js request). That invariant is irrelevant here — there's no
// route cache to invalidate outside a real request — so it's safe to ignore.
function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    // No-op outside a Next.js request context (e.g. tests).
  }
}
