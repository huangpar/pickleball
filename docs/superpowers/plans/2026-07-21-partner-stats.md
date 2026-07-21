# Doubles Partner Stats on Player Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a viewer pick one of a player's past doubles partners from a dropdown on that player's profile page and see their win/loss record together, broken down by which specific opposing team they faced.

**Architecture:** A new data-layer function builds partner/opponent breakdowns entirely from the existing `getPlayerMatchHistory` result (no new database queries). A new client component renders a partner-picking dropdown and the resulting breakdown, wired into the player profile page.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres/Neon), Next.js Server Components, React (client component with `useState`), Vitest, React Testing Library.

## Global Constraints

- Covers all doubles history, all-time, both fixed-team and rotating-partner tournaments — achieved for free by building on `getPlayerMatchHistory`, which already queries across all tournaments with no format/team-mode filtering.
- No selection until the viewer picks one — the dropdown starts on a placeholder option and nothing else renders until a partner is chosen.
- If a player has no doubles partners at all, the whole section (including its heading) is omitted from the page — not an empty state message.
- No new database queries — the data layer reuses `getPlayerMatchHistory`'s already-correct joins and filtering.

---

### Task 1: Partner breakdown data layer

**Files:**
- Create: `lib/data/partnerBreakdown.ts`
- Create: `lib/data/partnerBreakdown.test.ts`

**Interfaces:**
- Consumes: `getPlayerMatchHistory(playerId: string): Promise<MatchHistoryEntry[]>` from `lib/data/matchHistory.ts` (unchanged; `MatchHistoryEntry` has `partnerNames: string[]`, `opponentNames: string[]`, `won: boolean`). `computeWins(outcomes: MatchOutcome[]): number` and `computeWinPercentage(outcomes: MatchOutcome[]): number` from `lib/stats.ts` (unchanged; `MatchHistoryEntry` structurally satisfies `MatchOutcome`, so it can be passed directly).
- Produces: `export interface OpponentRecord { opponentNames: string[]; wins: number; losses: number }`, `export interface PartnerBreakdown { partnerName: string; wins: number; losses: number; winPercentage: number; opponents: OpponentRecord[] }`, `export async function getPlayerPartnerBreakdown(playerId: string): Promise<PartnerBreakdown[]>` — the array is sorted alphabetically by `partnerName`, and each entry's `opponents` array is sorted alphabetically by the joined opponent-team name.

- [ ] **Step 1: Write the failing tests**

Create `lib/data/partnerBreakdown.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify the tests fail**

Run: `npx vitest run lib/data/partnerBreakdown.test.ts`
Expected: FAIL — `./partnerBreakdown` module doesn't exist yet.

- [ ] **Step 3: Implement `getPlayerPartnerBreakdown`**

Create `lib/data/partnerBreakdown.ts`:

```ts
import { getPlayerMatchHistory } from "./matchHistory";
import { computeWins, computeWinPercentage } from "@/lib/stats";

export interface OpponentRecord {
  opponentNames: string[];
  wins: number;
  losses: number;
}

export interface PartnerBreakdown {
  partnerName: string;
  wins: number;
  losses: number;
  winPercentage: number;
  opponents: OpponentRecord[];
}

export async function getPlayerPartnerBreakdown(playerId: string): Promise<PartnerBreakdown[]> {
  const history = await getPlayerMatchHistory(playerId);
  const doublesEntries = history.filter((entry) => entry.partnerNames.length > 0);

  const byPartner = new Map<string, typeof doublesEntries>();
  for (const entry of doublesEntries) {
    const partnerName = entry.partnerNames[0];
    const list = byPartner.get(partnerName) ?? [];
    list.push(entry);
    byPartner.set(partnerName, list);
  }

  const breakdowns: PartnerBreakdown[] = [];
  for (const [partnerName, entries] of byPartner) {
    const byOpponentTeam = new Map<string, OpponentRecord>();
    for (const entry of entries) {
      const sortedOpponentNames = [...entry.opponentNames].sort();
      const opponentKey = sortedOpponentNames.join(" & ");
      const record = byOpponentTeam.get(opponentKey) ?? { opponentNames: sortedOpponentNames, wins: 0, losses: 0 };
      if (entry.won) record.wins++;
      else record.losses++;
      byOpponentTeam.set(opponentKey, record);
    }

    const wins = computeWins(entries);
    breakdowns.push({
      partnerName,
      wins,
      losses: entries.length - wins,
      winPercentage: computeWinPercentage(entries),
      opponents: [...byOpponentTeam.values()].sort((a, b) =>
        a.opponentNames.join(" & ").localeCompare(b.opponentNames.join(" & "))
      ),
    });
  }

  return breakdowns.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npx vitest run lib/data/partnerBreakdown.test.ts`
Expected: PASS — all 4 tests.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run`
Expected: PASS, all files (this is a new file with no existing consumers yet, so nothing else should be affected).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/data/partnerBreakdown.ts lib/data/partnerBreakdown.test.ts
git commit -m "$(cat <<'EOF'
Add doubles partner breakdown data layer

Groups a player's match history by doubles partner and, within
each partner, by opposing team, reusing the existing match-history
query rather than adding new database access.
EOF
)"
```

---

### Task 2: Partner picker UI on the player profile page

**Files:**
- Create: `components/players/PartnerBreakdown.tsx`
- Create: `components/players/PartnerBreakdown.test.tsx`
- Modify: `app/players/[id]/page.tsx`

**Interfaces:**
- Consumes: `PartnerBreakdown` and `OpponentRecord` types, `getPlayerPartnerBreakdown` (Task 1).
- Produces: `PartnerBreakdown` React component with props `{ breakdown: PartnerBreakdownData[] }` (the import is aliased to `PartnerBreakdownData` inside the component file to avoid the component's own name shadowing the imported type — see Step 3).

- [ ] **Step 1: Write the failing tests**

Create `components/players/PartnerBreakdown.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartnerBreakdown } from "./PartnerBreakdown";
import type { PartnerBreakdown as PartnerBreakdownData } from "@/lib/data/partnerBreakdown";

describe("PartnerBreakdown", () => {
  const sampleBreakdown: PartnerBreakdownData[] = [
    {
      partnerName: "Casey Nguyen",
      wins: 3,
      losses: 1,
      winPercentage: 75,
      opponents: [
        { opponentNames: ["Ben Rivera", "Dana Kim"], wins: 2, losses: 0 },
        { opponentNames: ["Emery Cole", "Frank Diaz"], wins: 1, losses: 1 },
      ],
    },
  ];

  it("renders nothing when the breakdown is empty", () => {
    const { container } = render(<PartnerBreakdown breakdown={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the dropdown with no breakdown visible until a partner is selected", () => {
    render(<PartnerBreakdown breakdown={sampleBreakdown} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText(/Overall with/)).not.toBeInTheDocument();
  });

  it("shows the overall record and per-opponent breakdown after selecting a partner", () => {
    render(<PartnerBreakdown breakdown={sampleBreakdown} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Casey Nguyen" } });

    expect(screen.getByText(/Overall with Casey Nguyen: 3-1/)).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera & Dana Kim")).toBeInTheDocument();
    expect(screen.getByText("2-0")).toBeInTheDocument();
    expect(screen.getByText("Emery Cole & Frank Diaz")).toBeInTheDocument();
    expect(screen.getByText("1-1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify the tests fail**

Run: `npx vitest run components/players/PartnerBreakdown.test.tsx`
Expected: FAIL — `./PartnerBreakdown` module doesn't exist yet.

- [ ] **Step 3: Implement the component**

Create `components/players/PartnerBreakdown.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import type { PartnerBreakdown as PartnerBreakdownData } from "@/lib/data/partnerBreakdown";

export function PartnerBreakdown({ breakdown }: { breakdown: PartnerBreakdownData[] }) {
  const [selectedPartner, setSelectedPartner] = useState("");

  if (breakdown.length === 0) return null;

  const selected = breakdown.find((b) => b.partnerName === selectedPartner);

  return (
    <Card>
      <h2 className="font-headline text-lg font-semibold mb-4">Doubles Partners</h2>
      <label className="flex flex-col text-sm gap-1 max-w-xs">
        Doubles partner
        <select
          value={selectedPartner}
          onChange={(e) => setSelectedPartner(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2"
        >
          <option value="">Select a partner…</option>
          {breakdown.map((b) => (
            <option key={b.partnerName} value={b.partnerName}>
              {b.partnerName}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="mt-4 space-y-2">
          <p className="font-body font-medium">
            Overall with {selected.partnerName}: {selected.wins}-{selected.losses} · {selected.winPercentage}%
          </p>
          <ul className="divide-y divide-outline-variant/30">
            {selected.opponents.map((o) => (
              <li key={o.opponentNames.join(" & ")} className="flex items-center justify-between py-2">
                <span className="text-on-surface-variant">{o.opponentNames.join(" & ")}</span>
                <span className="font-mono font-semibold">
                  {o.wins}-{o.losses}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npx vitest run components/players/PartnerBreakdown.test.tsx`
Expected: PASS — all 3 tests.

- [ ] **Step 5: Wire into the player profile page**

In `app/players/[id]/page.tsx`, add two imports alongside the existing ones:

```tsx
import { getPlayerPartnerBreakdown } from "@/lib/data/partnerBreakdown";
import { PartnerBreakdown } from "@/components/players/PartnerBreakdown";
```

Find this exact block:

```tsx
  const [outcomes, history, standings] = await Promise.all([
    getPlayerMatchOutcomes(player.id),
    getPlayerMatchHistory(player.id),
    getStandings(),
  ]);
```

Replace it with:

```tsx
  const [outcomes, history, standings, partnerBreakdown] = await Promise.all([
    getPlayerMatchOutcomes(player.id),
    getPlayerMatchHistory(player.id),
    getStandings(),
    getPlayerPartnerBreakdown(player.id),
  ]);
```

Find this exact block (the closing Match History `Card`, right before `</main>`):

```tsx
      <Card className="p-0 divide-y divide-surface-container-high">
        <h2 className="font-headline text-lg font-semibold p-6 pb-0">Match History</h2>
        {history.length === 0 && <p className="p-6 text-on-surface-variant">No matches played yet.</p>}
        {history.map((entry) => (
          <div key={entry.matchId} className="flex items-center justify-between p-6">
            <div>
              <p className="font-body font-medium">
                vs. {entry.opponentNames.join(" & ")}
                {entry.partnerNames.length > 0 && (
                  <span className="text-on-surface-variant"> (with {entry.partnerNames.join(" & ")})</span>
                )}
              </p>
              <p className="font-mono text-xs text-on-surface-variant">{entry.tournamentName}</p>
            </div>
            <p className={`font-headline font-semibold ${entry.won ? "text-secondary" : "text-error"}`}>
              {entry.ownScore}-{entry.opponentScore}
            </p>
          </div>
        ))}
      </Card>
    </main>
  );
}
```

Replace it with:

```tsx
      <Card className="p-0 divide-y divide-surface-container-high">
        <h2 className="font-headline text-lg font-semibold p-6 pb-0">Match History</h2>
        {history.length === 0 && <p className="p-6 text-on-surface-variant">No matches played yet.</p>}
        {history.map((entry) => (
          <div key={entry.matchId} className="flex items-center justify-between p-6">
            <div>
              <p className="font-body font-medium">
                vs. {entry.opponentNames.join(" & ")}
                {entry.partnerNames.length > 0 && (
                  <span className="text-on-surface-variant"> (with {entry.partnerNames.join(" & ")})</span>
                )}
              </p>
              <p className="font-mono text-xs text-on-surface-variant">{entry.tournamentName}</p>
            </div>
            <p className={`font-headline font-semibold ${entry.won ? "text-secondary" : "text-error"}`}>
              {entry.ownScore}-{entry.opponentScore}
            </p>
          </div>
        ))}
      </Card>

      <PartnerBreakdown breakdown={partnerBreakdown} />
    </main>
  );
}
```

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npx vitest run`
Expected: PASS, all files.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/players/PartnerBreakdown.tsx components/players/PartnerBreakdown.test.tsx app/players/[id]/page.tsx
git commit -m "$(cat <<'EOF'
Add doubles partner picker to player profile page

Lets a viewer select one of a player's past doubles partners and
see their combined record broken down by opposing team. The
section is omitted entirely for players with no doubles history.
EOF
)"
```
