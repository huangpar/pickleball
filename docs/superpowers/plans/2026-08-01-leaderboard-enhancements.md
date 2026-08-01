# Leaderboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add point differential (total points scored - points allowed) and win/loss record (formatted as "5W-2L") to player standings on both global and tournament-specific pages.

**Architecture:** Enhance the `StandingRow` type with `losses` and `pointDifferential` fields, compute these in the data layer from existing match outcomes and scores, then render them as additional columns on desktop tables and compressed metrics on mobile cards.

**Tech Stack:** TypeScript, React, Tailwind CSS, Drizzle ORM, Vitest

## Global Constraints

- Point differential computed from finalized matches only (status = "final")
- Losses calculated as: matchesPlayed - wins
- Point differential color-coded: green for positive, red for negative, gray for zero
- No schema changes; uses existing match score data
- Mobile cards display W-L and point diff in compressed format (e.g., "5W-2L · +47")
- Display-only metrics (not sortable)

---

### Task 1: Type Changes and Helper Functions

**Files:**
- Modify: `lib/standings.ts`
- Test: `lib/standings.test.ts`

**Interfaces:**
- Consumes: Match outcome data (existing getPlayerMatchOutcomes returns outcome objects with match and score info)
- Produces: Updated `StandingRow` type with `losses` and `pointDifferential` properties; helper function `computePointDifferential(outcomes): number`

- [ ] **Step 1: Update StandingRow type**

Open `lib/standings.ts` and modify the `StandingRow` interface:

```ts
export interface StandingRow {
  id: string;
  name: string;
  wins: number;
  losses: number;               // NEW
  matchesPlayed: number;
  winPercentage: number;
  pointDifferential: number;    // NEW
  trend: "up" | "down" | "flat";
}
```

- [ ] **Step 2: Add computePointDifferential helper function**

Add this function to `lib/standings.ts` after the `StandingRow` interface:

```ts
import type { PlayerMatchOutcome } from "@/lib/data/players";

export function computePointDifferential(outcomes: PlayerMatchOutcome[]): number {
  return outcomes
    .filter((outcome) => outcome.match.status === "final")
    .reduce((diff, outcome) => {
      const playerScore = outcome.side === 1 ? outcome.match.side1Score : outcome.match.side2Score;
      const opponentScore = outcome.side === 1 ? outcome.match.side2Score : outcome.match.side1Score;
      
      if (playerScore === null || opponentScore === null) return diff;
      
      return diff + (playerScore - opponentScore);
    }, 0);
}
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run:
```bash
npx vitest run lib/standings.test.ts
```

Expected: All existing tests pass. The type change is additive; existing code paths remain compatible (TypeScript will flag missing fields in new `StandingRow` objects, which we'll fix in later tasks).

- [ ] **Step 4: Commit**

```bash
git add lib/standings.ts
git commit -m "feat: add losses and pointDifferential to StandingRow type and computePointDifferential helper"
```

---

### Task 2: Update Global Standings Data Layer

**Files:**
- Modify: `lib/data/standings.ts`
- Test: `lib/data/standings.test.ts`

**Interfaces:**
- Consumes: `computePointDifferential()` from Task 1, existing `getPlayerMatchOutcomes()`, `computeWins()`, `computeWinPercentage()`, `computeTrend()`
- Produces: Updated `getStandings()` that returns `StandingRow[]` with all new fields populated

- [ ] **Step 1: Write failing test for losses calculation**

Open `lib/data/standings.test.ts` and add:

```ts
it("computes losses as matchesPlayed - wins", async () => {
  // Create player with 3 wins out of 5 matches
  const player = await createTestPlayer("Test Player");
  const outcomes = [
    createOutcome(player.id, true),   // win
    createOutcome(player.id, true),   // win
    createOutcome(player.id, true),   // win
    createOutcome(player.id, false),  // loss
    createOutcome(player.id, false),  // loss
  ];
  
  const standings = await getStandings();
  const row = standings.find((s) => s.id === player.id);
  
  expect(row?.wins).toBe(3);
  expect(row?.matchesPlayed).toBe(5);
  expect(row?.losses).toBe(2);  // 5 - 3
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run lib/data/standings.test.ts -t "computes losses"
```

Expected: FAIL - "losses" property is undefined on `row`.

- [ ] **Step 3: Update getStandings to compute losses**

Open `lib/data/standings.ts`. In the `getStandings()` function, update the loop where `StandingRow` objects are created:

```ts
export async function getStandings(dateRange?: DateRange): Promise<StandingRow[]> {
  const allPlayers = await getAllPlayers();

  const rows: StandingRow[] = [];
  for (const player of allPlayers) {
    const outcomes = await getPlayerMatchOutcomes(player.id, dateRange);
    const wins = computeWins(outcomes);
    
    rows.push({
      id: player.id,
      name: player.name,
      wins,
      losses: outcomes.length - wins,  // NEW
      matchesPlayed: outcomes.length,
      winPercentage: computeWinPercentage(outcomes),
      pointDifferential: computePointDifferential(outcomes),  // NEW
      trend: computeTrend(outcomes),
    });
  }
  return rows;
}
```

Don't forget to import `computePointDifferential` from `@/lib/standings`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run lib/data/standings.test.ts -t "computes losses"
```

Expected: PASS

- [ ] **Step 5: Write and run test for pointDifferential calculation**

Add to `lib/data/standings.test.ts`:

```ts
it("computes point differential correctly", async () => {
  const player = await createTestPlayer("Test Player");
  
  // Create finalized matches with known scores
  // Match 1: player on side1 (10) vs side2 (8) → +2
  // Match 2: player on side2 (7) vs side1 (11) → -4
  // Match 3: unfinished (not counted)
  const outcomes = [
    createOutcome(player.id, true, { side1Score: 10, side2Score: 8, status: "final" }),
    createOutcome(player.id, false, { side1Score: 11, side2Score: 7, status: "final" }),
    createOutcome(player.id, false, { side1Score: null, side2Score: null, status: "scheduled" }),
  ];
  
  const standings = await getStandings();
  const row = standings.find((s) => s.id === player.id);
  
  expect(row?.pointDifferential).toBe(-2);  // 10-8 + 7-11 = 2 - 4 = -2
});
```

Run:
```bash
npx vitest run lib/data/standings.test.ts -t "computes point differential"
```

Expected: PASS

- [ ] **Step 6: Run full standings test suite**

Run:
```bash
npx vitest run lib/data/standings.test.ts
```

Expected: All tests pass (including new ones and existing ones).

- [ ] **Step 7: Commit**

```bash
git add lib/data/standings.ts lib/data/standings.test.ts
git commit -m "feat: compute losses and pointDifferential in global standings data layer"
```

---

### Task 3: Update Tournament Standings Data Layer

**Files:**
- Modify: `lib/data/tournamentStandings.ts`
- Test: `lib/data/tournamentStandings.test.ts`

**Interfaces:**
- Consumes: Same as Task 2 (computePointDifferential, getPlayerMatchOutcomes, etc.)
- Produces: Updated `getTournamentStandings()` returning `StandingRow[]` with new fields

- [ ] **Step 1: Write failing test for tournament standings losses and point differential**

Open `lib/data/tournamentStandings.test.ts` and add:

```ts
it("computes losses and pointDifferential scoped to tournament", async () => {
  const player = await createTestPlayer("Test Player");
  const tournament = await createTestTournament({ participants: [player.id] });
  
  // Create matches in this tournament and another
  const match1 = await createMatch(tournament.id, player.id, true, { side1Score: 10, side2Score: 8, status: "final" });
  const match2 = await createMatch(tournament.id, player.id, false, { side1Score: 7, side2Score: 11, status: "final" });
  const otherTournament = await createTestTournament({ participants: [player.id] });
  const match3 = await createMatch(otherTournament.id, player.id, true, { side1Score: 15, side2Score: 5, status: "final" });
  
  const standings = await getTournamentStandings(tournament.id);
  const row = standings.find((s) => s.id === player.id);
  
  // Only matches 1 & 2 should be counted
  expect(row?.wins).toBe(1);
  expect(row?.losses).toBe(1);
  expect(row?.matchesPlayed).toBe(2);
  expect(row?.pointDifferential).toBe(-2);  // 10-8 + 7-11 = -2 (match3 excluded)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run lib/data/tournamentStandings.test.ts -t "scoped to tournament"
```

Expected: FAIL

- [ ] **Step 3: Update getTournamentStandings to compute losses and pointDifferential**

Open `lib/data/tournamentStandings.ts`. Find the `getTournamentStandings(tournamentId)` function and update it similarly to Task 2:

```ts
export async function getTournamentStandings(tournamentId: string): Promise<StandingRow[]> {
  const participants = await getTournamentParticipants(tournamentId);
  
  const rows: StandingRow[] = [];
  for (const participant of participants) {
    const outcomes = await getPlayerMatchOutcomes(participant.id, undefined, tournamentId);
    const wins = computeWins(outcomes);
    
    rows.push({
      id: participant.id,
      name: participant.name,
      wins,
      losses: outcomes.length - wins,  // NEW
      matchesPlayed: outcomes.length,
      winPercentage: computeWinPercentage(outcomes),
      pointDifferential: computePointDifferential(outcomes),  // NEW
      trend: computeTrend(outcomes),
    });
  }
  return rows;
}
```

Import `computePointDifferential` from `@/lib/standings`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run lib/data/tournamentStandings.test.ts -t "scoped to tournament"
```

Expected: PASS

- [ ] **Step 5: Run full tournament standings test suite**

Run:
```bash
npx vitest run lib/data/tournamentStandings.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/data/tournamentStandings.ts lib/data/tournamentStandings.test.ts
git commit -m "feat: compute losses and pointDifferential in tournament standings data layer"
```

---

### Task 4: Update Global StandingsTable UI Component

**Files:**
- Modify: `components/standings/StandingsTable.tsx`
- Test: `components/standings/StandingsTable.test.tsx`

**Interfaces:**
- Consumes: Updated `StandingRow` type with `losses` and `pointDifferential`
- Produces: Rendered table/cards with new columns and metrics visible

- [ ] **Step 1: Write failing tests for new columns**

Open `components/standings/StandingsTable.test.tsx` and add:

```ts
it("displays W-L Record column on desktop table", async () => {
  const standings: StandingRow[] = [
    { id: "p1", name: "Alice", wins: 5, losses: 2, matchesPlayed: 7, winPercentage: 71, pointDifferential: 12, trend: "up" },
  ];
  
  render(<StandingsTable initialStandings={standings} />);
  
  expect(screen.getByText("5W-2L")).toBeInTheDocument();
});

it("displays Point Diff column with correct formatting", async () => {
  const standings: StandingRow[] = [
    { id: "p1", name: "Alice", wins: 5, losses: 2, matchesPlayed: 7, winPercentage: 71, pointDifferential: 12, trend: "up" },
    { id: "p2", name: "Bob", wins: 3, losses: 4, matchesPlayed: 7, winPercentage: 43, pointDifferential: -8, trend: "down" },
  ];
  
  render(<StandingsTable initialStandings={standings} />);
  
  expect(screen.getByText("+12")).toBeInTheDocument();
  expect(screen.getByText("-8")).toBeInTheDocument();
});

it("displays compressed metrics on mobile cards", async () => {
  const standings: StandingRow[] = [
    { id: "p1", name: "Alice", wins: 5, losses: 2, matchesPlayed: 7, winPercentage: 71, pointDifferential: 12, trend: "up" },
  ];
  
  render(<StandingsTable initialStandings={standings} />);
  
  // Mobile card should show "5W-2L · +12 · ↑"
  expect(screen.getByText(/5W-2L.*\+12/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run components/standings/StandingsTable.test.tsx -t "displays W-L|displays Point Diff|compressed metrics"
```

Expected: FAIL - new elements not found.

- [ ] **Step 3: Update desktop table to add new columns**

Open `components/standings/StandingsTable.tsx`. Find the desktop table section (starting around line 58). Update the `<thead>` to add two new columns:

```tsx
<thead>
  <tr className="text-left font-mono text-xs text-on-surface-variant uppercase border-b border-surface-container-high">
    <th className="p-4">Rank</th>
    <th className="p-4">Player</th>
    <th className="p-4">Wins</th>
    <th className="p-4">W-L Record</th>        {/* NEW */}
    <th className="p-4">Win %</th>
    <th className="p-4">Point Diff</th>       {/* NEW */}
    <th className="p-4">Matches</th>
    <th className="p-4">Trend</th>
  </tr>
</thead>
```

Update the `<tbody>` to render the new columns:

```tsx
<tbody>
  {sorted.map((row, i) => (
    <tr key={row.id} className="border-b border-surface-container-high last:border-0">
      <td className="p-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Avatar name={row.name} size="sm" />
          {row.name}
        </div>
      </td>
      <td className="p-4">{row.wins}</td>
      <td className="p-4 font-semibold">{row.wins}W-{row.losses}L</td>  {/* NEW */}
      <td className="p-4">{row.winPercentage}%</td>
      <td className={`p-4 font-semibold ${
        row.pointDifferential > 0 ? "text-green-600" :
        row.pointDifferential < 0 ? "text-red-600" :
        "text-on-surface-variant"
      }`}>
        {row.pointDifferential > 0 ? "+" : ""}{row.pointDifferential}
      </td>  {/* NEW */}
      <td className="p-4">{row.matchesPlayed}</td>
      <td className="p-4">{row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}</td>
    </tr>
  ))}
</tbody>
```

- [ ] **Step 4: Update mobile cards to include compressed metrics**

Find the mobile card section (around line 90). Update the subtitle to include the new metrics:

```tsx
<Card className="p-0 md:hidden divide-y divide-surface-container-high" data-testid="standings-cards">
  {sorted.map((row, i) => (
    <div key={row.id} className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
        <Avatar name={row.name} size="sm" />
        <div>
          <p className="font-body font-medium">{row.name}</p>
          <p className="font-mono text-xs text-on-surface-variant">
            {row.wins}W-{row.losses}L · {row.pointDifferential > 0 ? "+" : ""}{row.pointDifferential} · {row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-headline font-bold">{row.wins}W</p>
        <p className="font-mono text-xs text-on-surface-variant">
          {row.winPercentage}% &middot; {row.matchesPlayed}m
        </p>
      </div>
    </div>
  ))}
</Card>
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run components/standings/StandingsTable.test.tsx
```

Expected: All tests pass, including new ones.

- [ ] **Step 6: Run full component test suite to verify no regressions**

Run:
```bash
npx vitest run components/standings/
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/standings/StandingsTable.tsx components/standings/StandingsTable.test.tsx
git commit -m "feat: add W-L Record and Point Diff columns to global standings table"
```

---

### Task 5: Update Tournament StandingsTable UI Component

**Files:**
- Modify: `components/tournaments/TournamentStandingsTable.tsx`
- Test: `components/tournaments/TournamentStandingsTable.test.tsx`

**Interfaces:**
- Consumes: Updated `StandingRow` type
- Produces: Tournament standings with new columns

- [ ] **Step 1: Write failing tests**

Open `components/tournaments/TournamentStandingsTable.test.tsx` and add similar tests to Task 4:

```ts
it("displays W-L Record and Point Diff on tournament standings", async () => {
  const standings: StandingRow[] = [
    { id: "p1", name: "Alice", wins: 3, losses: 1, matchesPlayed: 4, winPercentage: 75, pointDifferential: 8, trend: "up" },
  ];
  
  render(<TournamentStandingsTable initialStandings={standings} />);
  
  expect(screen.getByText("3W-1L")).toBeInTheDocument();
  expect(screen.getByText("+8")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run components/tournaments/TournamentStandingsTable.test.tsx -t "displays W-L"
```

Expected: FAIL

- [ ] **Step 3: Update TournamentStandingsTable component**

Open `components/tournaments/TournamentStandingsTable.tsx` and apply the same changes as Task 4 (add W-L Record and Point Diff columns to both desktop table and mobile cards).

The file structure should be similar to StandingsTable.tsx. Update `<thead>`, `<tbody>`, and mobile card sections with the new columns.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run components/tournaments/TournamentStandingsTable.test.tsx
```

Expected: All tests pass.

- [ ] **Step 5: Run full component test suite**

Run:
```bash
npx vitest run components/tournaments/
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/tournaments/TournamentStandingsTable.tsx components/tournaments/TournamentStandingsTable.test.tsx
git commit -m "feat: add W-L Record and Point Diff columns to tournament standings"
```

---

### Task 6: Final Verification

**Files:**
- All previous files (read-only for verification)

**Interfaces:**
- Consumes: Completed tasks 1-5
- Produces: Verified feature working end-to-end

- [ ] **Step 1: Run full test suite**

Run:
```bash
npx vitest run
```

Expected: All 147+ tests pass (existing + new).

- [ ] **Step 2: Run TypeScript type check**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors. All `StandingRow` instantiations include `losses` and `pointDifferential`.

- [ ] **Step 3: Manual verification on dev server**

Start the dev server:
```bash
npm run dev
```

Navigate to:
- `http://localhost:3000/standings` — global standings page
- `http://localhost:3000/tournaments/[id]` — tournament detail page (if a tournament exists)

Verify:
- Desktop table shows columns: Rank | Player | Wins | W-L Record | Win % | Point Diff | Matches | Trend
- Mobile cards show: "5W-2L · +12 · ↑" format in subtitle
- Point Diff values are color-coded (green if positive, red if negative)
- No layout breaks or text overflow

- [ ] **Step 4: Commit verification summary**

```bash
git log --oneline -6
```

Expected output should show the 5 commits from tasks 1-5. No additional commits needed; verification is observational only.

---

## Plan Summary

**Tasks:** 6 total
1. Type changes and helpers
2. Global standings data layer  
3. Tournament standings data layer
4. Global standings UI
5. Tournament standings UI
6. Final verification

**Test coverage:**
- Data layer: losses and pointDifferential calculations, edge cases (unfinished matches, zero scores)
- Components: column rendering, mobile compression, color coding
- End-to-end: dev server verification

**No schema changes.** All calculations use existing `match.side1Score`, `match.side2Score`, and `match.status`.
