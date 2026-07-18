"use server";

import { db } from "@/lib/db/client";
import { players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PlayerRow } from "@/lib/data/players";

export async function createPlayer(formData: FormData): Promise<PlayerRow> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Name is required");
  }
  const [inserted] = await db
    .insert(players)
    .values({ name })
    .returning({ id: players.id, name: players.name });
  revalidatePath("/players");
  return inserted;
}

export async function updatePlayer(id: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Name is required");
  }
  await db.update(players).set({ name }).where(eq(players.id, id));
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
}
