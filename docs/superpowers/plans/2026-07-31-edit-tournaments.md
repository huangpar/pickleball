# Edit Tournaments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow editing tournament participants and rounds before any matches are played, with automatic match regeneration when either field changes.

**Architecture:** New server action validates setup status, deletes old matches, updates participants/rounds, regenerates bracket using existing schedulers, and revalidates caches. UI adds edit button/icon visible only in setup status, with modal/form reusing ParticipantPicker and rounds input.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM + Neon Postgres, Vitest + Testing Library, React hooks.

## Global Constraints

- Edit allowed only when `tournaments.status === "setup"` (no matches played yet)
- Participants and rounds are editable; tournament name/format/teamMode are locked
- Minimum 2 participants required; doubles constraints enforced (even count for fixed, ≥4 for rotating/hybrid)
- Match regeneration is atomic: all old matches deleted before new ones inserted
- No new database migrations required; existing schema sufficient
- Revalidate `/tournaments` and `/tournaments/[id]` after edit

---

### Task 1: Server-side edit action

**Files:**
- Modify: `lib/actions/tournaments.ts`
- Test: `lib/actions/tournaments.test.ts`

**Interfaces:**
- Produces (for Task 2 to consume):
  - `export async function editTournament(tournamentId: string, participantIds: string[], numRounds: number): Promise<void>`

This task adds a new server action that validates the tournament is in setup status, deletes all existing matches, updates participants and rounds, regenerates the bracket, and revalidates caches. No new types or database changes.

- [ ] **Step 1: Write the failing test**

Add to `lib/actions/tournaments.test.ts`, inside the describe block:

```ts
  it("rejects edit if tournament is not in setup status", async () => {
    const [p1] = await db.insert(players).values({ name: "__Edit P1__" }).returning();
    const [tournament] = await db
      .insert(tournaments)
      .values({
        name: "__Edit Tournament__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        status: "in_progress",
      })
      .returning();
    insertedPlayerIds.push(p1.id);
    createdTournamentIds.push(tournament.id);

    await expect(editTournament(tournament.id, [p1.id], 1)).rejects.toThrow(
      "Tournament is not in setup status"
    );
  });

  it("successfully updates participants for a setup tournament", async () => {
    const [p1] = await db.insert(players).values({ name: "__Edit P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Edit P2__" }).returning();
    const [p3] = await db.insert(players).values({ name: "__Edit P3__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id, p3.id);

    const formData = new FormData();
    formData.set("name", "__Setup Tournament__");
    formData.set("numCourts", "1");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "singles");
    formData.append("participantIds", p1.id);
    formData.append("participantIds", p2.id);

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    const [originalMatch] = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(originalMatch).toBeDefined();

    await editTournament(tournamentId, [p1.id, p2.id, p3.id], 1);

    const [updatedTournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    const participants = await db.select().from(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
    expect(participants).toHaveLength(3);
    expect(new Set(participants.map(p => p.playerId))).toEqual(new Set([p1.id, p2.id, p3.id]));

    const newMatches = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(newMatches).toHaveLength(3); // C(3,2) for singles
  });

  it("rejects edit if fewer than 2 participants", async () => {
    const [p1] = await db.insert(players).values({ name: "__Edit Lone__" }).returning();
    insertedPlayerIds.push(p1.id);

    const formData = new FormData();
    formData.set("name", "__Setup Lone__");
    formData.set("numCourts", "1");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "singles");
    formData.append("participantIds", p1.id);
    formData.append("participantIds", p1.id);

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    await expect(editTournament(tournamentId, [p1.id], 1)).rejects.toThrow(
      "Select at least 2 participants"
    );
  });
```

- [ ] **Step 2: Run the test file to verify tests fail**

Run: `npx vitest run lib/actions/tournaments.test.ts`
Expected: FAIL — `editTournament is not a function`.

- [ ] **Step 3: Implement `editTournament` in `lib/actions/tournaments.ts`**

Add the following function to the file (after `deleteTournament`):

```ts
export async function editTournament(
  tournamentId: string,
  participantIds: string[],
  numRounds: number
): Promise<void> {
  if (participantIds.length < 2) throw new Error("Select at least 2 participants");

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "setup") throw new Error("Tournament is not in setup status");

  const matchRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId));
  const matchIds = matchRows.map((m) => m.id);
  if (matchIds.length > 0) {
    await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, matchIds));
    await db.delete(matches).where(inArray(matches.id, matchIds));
  }

  await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
  await db.insert(tournamentParticipants).values(participantIds.map((playerId) => ({ tournamentId, playerId })));

  if (numRounds !== tournament.numRounds) {
    await db.update(tournaments).set({ numRounds }).where(eq(tournaments.id, tournamentId));
  }

  let schedule: ScheduledMatch[];
  if (tournament.matchFormat === "singles") {
    schedule = generateSinglesSchedule(participantIds, tournament.numCourts);
  } else {
    if (tournament.teamMode === "fixed") {
      const participantSet = new Set(participantIds);
      const oldParticipants = await db
        .select({ playerId: tournamentParticipants.playerId })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));
      const oldTeamStrings = await db
        .select()
        .from(matches)
        .where(eq(matches.tournamentId, tournamentId))
        .limit(1);

      throw new Error("Cannot re-edit fixed teams (no stored mapping)");
    } else if (tournament.teamMode === "rotating") {
      schedule = generateRotatingDoublesSchedule(participantIds, tournament.numCourts, numRounds);
    } else if (tournament.teamMode === "hybrid") {
      throw new Error("Hybrid re-edit not yet supported (no stored fixed-pair mapping)");
    } else {
      throw new Error("Unknown team mode");
    }
  }

  for (const scheduledMatch of schedule) {
    const [insertedMatch] = await db
      .insert(matches)
      .values({
        tournamentId,
        courtNumber: scheduledMatch.courtNumber,
        roundNumber: scheduledMatch.roundNumber,
        status: "scheduled",
        firstServerId: scheduledMatch.firstServerId,
      })
      .returning();

    await db.insert(matchParticipants).values([
      ...scheduledMatch.side1PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 1 })),
      ...scheduledMatch.side2PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 2 })),
    ]);
  }

  safeRevalidatePath("/tournaments");
  safeRevalidatePath(`/tournaments/${tournamentId}`);
}
```

**Note:** Fixed teams and hybrid modes cannot be re-edited because the original fixed-pair/team mapping is not stored in the database — only the resulting matches. This is a known limitation documented in the test. For now, throw an error for these modes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/actions/tournaments.test.ts`
Expected: 3 new tests PASS (13 total in generateBracket suite).

- [ ] **Step 5: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests PASS (~140 total), no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/tournaments.ts lib/actions/tournaments.test.ts
git commit -m "Add editTournament server action for setup tournaments"
```

---

### Task 2: UI edit button and modal

**Files:**
- Modify: `app/tournaments/[id]/page.tsx`
- Modify: `app/tournaments/page.tsx`
- Create: `components/tournaments/EditTournamentModal.tsx` (optional; can reuse existing forms)
- Test: `components/tournaments/EditTournamentModal.test.tsx` (if creating new component)

**Interfaces:**
- Consumes (from Task 1): `editTournament(tournamentId, participantIds, numRounds)` from `lib/actions/tournaments`
- Uses existing: `ParticipantPicker`, `useRouter`, tournament detail data

The UI adds an "Edit" button visible only when tournament.status === "setup", opens a modal with participant picker and rounds input, and calls editTournament on save.

- [ ] **Step 1: Write the failing tests**

Create `components/tournaments/EditTournamentModal.test.tsx`:

```ts
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditTournamentModal } from "./EditTournamentModal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/tournaments", () => ({ editTournament: vi.fn() }));

describe("EditTournamentModal", () => {
  const mockPlayers = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Charlie" },
  ];

  it("renders the modal only when isOpen is true", () => {
    const { rerender } = render(
      <EditTournamentModal
        isOpen={false}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );
    expect(screen.queryByText("Edit Tournament")).not.toBeInTheDocument();

    rerender(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );
    expect(screen.getByText("Edit Tournament")).toBeInTheDocument();
  });

  it("shows participant picker with current participants pre-selected", () => {
    render(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );

    expect(screen.getByLabelText("Alice")).toBeChecked();
    expect(screen.getByLabelText("Bob")).toBeChecked();
    expect(screen.getByLabelText("Charlie")).not.toBeChecked();
  });

  it("shows rounds input only for doubles format", () => {
    const { rerender } = render(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );
    expect(screen.queryByLabelText(/Number of Rounds/i)).not.toBeInTheDocument();

    rerender(
      <EditTournamentModal
        isOpen={true}
        onClose={vi.fn()}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="doubles"
      />
    );
    expect(screen.getByLabelText(/Number of Rounds/i)).toBeInTheDocument();
  });

  it("closes modal on cancel", () => {
    const onClose = vi.fn();
    render(
      <EditTournamentModal
        isOpen={true}
        onClose={onClose}
        tournamentId="t1"
        currentParticipantIds={["p1", "p2"]}
        currentRounds={4}
        availablePlayers={mockPlayers}
        onCreatePlayer={vi.fn()}
        matchFormat="singles"
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/tournaments/EditTournamentModal.test.tsx`
Expected: FAIL — Component doesn't exist.

- [ ] **Step 3: Create `components/tournaments/EditTournamentModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editTournament } from "@/lib/actions/tournaments";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ParticipantPicker } from "./ParticipantPicker";
import type { PlayerRow } from "@/lib/data/players";

export function EditTournamentModal({
  isOpen,
  onClose,
  tournamentId,
  currentParticipantIds,
  currentRounds,
  availablePlayers,
  onCreatePlayer,
  matchFormat,
}: {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  currentParticipantIds: string[];
  currentRounds: number;
  availablePlayers: PlayerRow[];
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
  matchFormat: "singles" | "doubles";
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(currentParticipantIds);
  const [numRounds, setNumRounds] = useState<number | "">(currentRounds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setIsSubmitting(true);

    try {
      const rounds = numRounds === "" ? currentRounds : numRounds;
      await editTournament(tournamentId, selectedIds, rounds);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 space-y-4">
        <h2 className="font-headline text-lg font-semibold">Edit Tournament</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-headline text-sm font-semibold mb-2">Participants</h3>
            <ParticipantPicker
              availablePlayers={availablePlayers}
              selectedIds={selectedIds}
              onToggle={(id) =>
                setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
              }
              onPlayerAdded={(player) => {
                availablePlayers.push(player);
                setSelectedIds((prev) => [...prev, player.id]);
              }}
              onCreatePlayer={onCreatePlayer}
            />
          </div>

          {matchFormat === "doubles" && (
            <div>
              <label className="flex flex-col text-sm gap-1">
                Number of Rounds
                <input
                  type="number"
                  min={1}
                  value={numRounds}
                  onChange={(e) => setNumRounds(e.target.value === "" ? "" : Number(e.target.value))}
                  className="border border-outline-variant rounded px-3 py-2"
                />
              </label>
            </div>
          )}

          {error && <p className="text-error text-sm">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/tournaments/EditTournamentModal.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Modify `app/tournaments/[id]/page.tsx` to add edit button**

Add state and modal to the page component. At the top of the component:

```tsx
"use client";
import { useState } from "react";
import { EditTournamentModal } from "@/components/tournaments/EditTournamentModal";
```

In the JSX (near the tournament name or in the header), add:

```tsx
const [isEditOpen, setIsEditOpen] = useState(false);

// In the JSX, near the tournament title:
{tournament.status === "setup" && (
  <button onClick={() => setIsEditOpen(true)} className="text-sm text-secondary">
    Edit
  </button>
)}

// At the end of the page JSX, add the modal:
<EditTournamentModal
  isOpen={isEditOpen}
  onClose={() => setIsEditOpen(false)}
  tournamentId={tournament.id}
  currentParticipantIds={participants.map(p => p.playerId)}
  currentRounds={tournament.numRounds || 4}
  availablePlayers={/* fetch from data or pass as prop */}
  onCreatePlayer={onCreatePlayer}
  matchFormat={tournament.matchFormat as "singles" | "doubles"}
/>
```

**Note:** The `availablePlayers` and `onCreatePlayer` may need to be fetched or passed from the server. Verify the existing page structure for how to get these.

- [ ] **Step 6: Modify `app/tournaments/page.tsx` to add edit icon**

Add a pencil icon or small "Edit" link visible only when tournament.status === "setup" in each tournament row/card.

- [ ] **Step 7: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add app/tournaments/[id]/page.tsx app/tournaments/page.tsx components/tournaments/EditTournamentModal.tsx components/tournaments/EditTournamentModal.test.tsx
git commit -m "Add edit tournament UI: modal and buttons"
```

---

### Task 3: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (~145+ total).

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual verification in browser**

Start dev server, create a tournament, click Edit button, change participants/rounds, verify bracket regenerates and counts change.

- [ ] **Step 4: Report completion**

Document the edit tournaments feature as complete and ready for review.
