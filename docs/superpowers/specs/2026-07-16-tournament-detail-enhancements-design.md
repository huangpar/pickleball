# Tournament Detail Enhancements — Design

## Summary

Four related improvements to the Tournament Detail page (`app/tournaments/[id]/page.tsx`), all scoped to a single existing tournament:

1. Stack each match's player names and score input vertically (one row per side) instead of the current single horizontal line.
2. Show which participants are on a bye each round.
3. Add an "End Tournament" button that force-completes a tournament (with confirmation) regardless of whether all matches have scores.
4. Once a tournament is `completed` (via full scoring or via End Tournament), its match scores become read-only — enforced both in the UI and server-side.
5. Add a per-tournament leaderboard (simple read-only table: rank, player, wins, win %, matches played) in addition to the existing global Standings page.

No database schema changes. Byes and the per-tournament leaderboard are both derived at read time, reusing existing stats primitives (`computeWins`, `computeWinPercentage`, `computeTrend` from `lib/stats.ts`), consistent with how the rest of the app avoids storing derived data.

## Out of Scope

- Reopening a completed tournament (no "undo" for End Tournament).
- Sort toggle or CSV export on the per-tournament leaderboard (that's the global Standings page's job).
- Any change to the three scheduling algorithms (`lib/scheduling/*`) — byes are computed from existing match data, not generated differently.

## Data Layer Changes

### `lib/data/tournamentDetail.ts`

**`TournamentDetail` gains two fields:**
```ts
export interface TournamentDetail {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  matches: MatchDetail[];
  participants: { id: string; name: string }[]; // NEW — full tournament roster
  byes: { roundNumber: number; playerNames: string[] }[]; // NEW — only rounds with a bye
}
```

**`getTournamentDetail` implementation additions:**
- Query `tournamentParticipants` joined to `players` for `{ id, name }` — this is the tournament's full roster, independent of which matches were generated.
- The existing `matchParticipants` query (already fetched to build `MatchDetail`) is extended to also select `playerId` (currently only `side` and `name` are selected) — needed to compute byes by ID rather than by name (name-matching would break on duplicate names).
- For each distinct `roundNumber` present in `matches`, compute the set of `playerId`s appearing in any `matchParticipants` row for that round; any roster participant not in that set is on a bye that round. Only rounds with at least one bye are included in the returned `byes` array.

### New: `getTournamentStandings(tournamentId: string): Promise<StandingRow[]>`

Same file. For each participant in the tournament's roster:
1. Call the existing `getPlayerMatchOutcomes(playerId)` (from `lib/data/players.ts`, unchanged) — this returns *all* of that player's match outcomes across every tournament they've played.
2. Filter the result to only outcomes whose `matchId` belongs to this tournament (using the tournament's own match ID list, already available from the matches query).
3. Build a `StandingRow` via the existing `computeWins`/`computeWinPercentage`/`computeTrend` (`lib/stats.ts`, unchanged) over the filtered outcomes.

Sort by `wins` descending before returning (reuses the same ordering convention as the global Standings' default sort). Returns the existing `StandingRow` type from `lib/standings.ts` — no new type needed.

### `lib/actions/matches.ts`

**New: `endTournament(tournamentId: string): Promise<void>`**
```ts
export async function endTournament(tournamentId: string): Promise<void> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status === "completed") return; // idempotent no-op
  await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, tournamentId));
  safeRevalidatePath(`/tournaments/${tournamentId}`);
  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");
}
```
Sets the tournament to `completed` unconditionally — matches still `scheduled` at the time simply stay `scheduled` forever (they represent unplayed/skipped matches) and are displayed read-only alongside the played ones.

**`recordScore` gets one new guard**, added right after the tournament lookup: if `match`'s parent tournament is already `status === "completed"`, throw `"This tournament has ended — scores can no longer be edited"` before any validation or write. This is the server-side backstop — the UI disabling the form is a convenience, not the actual enforcement.

## UI Changes

### `components/tournaments/MatchScoreForm.tsx`

Signature grows to also own name rendering (previously the page rendered names in a separate `<div>` beside the form):
```ts
{
  side1PlayerNames: string[];
  side2PlayerNames: string[];
  side1Score: number | null;
  side2Score: number | null;
  disabled: boolean; // NEW
  onSubmit: (formData: FormData) => Promise<void>;
}
```

**Editable state** (`disabled === false`): two stacked rows, each `justify-between` with the side's name(s) on the left and that side's score `<input>` on the right:
```
[Side 1 names]                    [score input]
[Side 2 names]                    [score input]
[Save button]
```
(Replaces the current single-line `name1 vs name2  [input] - [input] [Save]` layout.)

**Read-only state** (`disabled === true`): same two-row structure, but each side renders its name(s) plus its final score as plain text (or "—" if the match was never played) — no `<input>`, no Save button, no error state.

### `app/tournaments/[id]/page.tsx`

- Pass `disabled={tournament.status === "completed"}` into every `MatchScoreForm`, along with the side name arrays already available on `MatchDetail`.
- Each round's `Card`: after the round's matches, if `tournament.byes` has an entry for that round, render a line: `Bye: {playerNames.join(", ")}`.
- Page header: next to the existing status `Badge`, render `<EndTournamentButton tournamentId={tournament.id} onEnd={endTournament.bind(null, tournament.id)} />` — a new client component, hidden when `tournament.status === "completed"`. On click: `window.confirm("End this tournament? Scores will no longer be editable.")`, and only calls the bound server action if confirmed. Standard loading/error handling matching the existing `MatchScoreForm`/`AddPlayerForm` pattern (disable button while pending, show an inline error message on failure).
- New card after the rounds: "Tournament Standings" — a read-only table (rank, player, wins, win %, matches played) fed by `getTournamentStandings(tournament.id)`, called alongside `getTournamentDetail` at the top of the page. Same row/column styling as the global `StandingsTable`'s table (no top-3 spotlight cards, no sort toggle, no CSV button — those are global-page-only per the earlier discussion).

## Testing

- `getTournamentDetail`'s bye computation: unit-testable against the real Neon DB (existing pattern) — a fixture tournament with an odd participant count in singles format should show the expected player on a bye in the round where the circle-method algorithm produces no pairing for them.
- `getTournamentStandings`: real-DB test — a participant with matches in two different tournaments should only have the current tournament's matches counted.
- `endTournament`: real-DB test covering both the normal case and the idempotent-no-op case (already-completed tournament).
- `recordScore`'s new guard: real-DB test asserting it throws once the tournament is `completed`.
- `MatchScoreForm`'s two render states (editable vs. read-only) and `EndTournamentButton`'s confirm-then-submit flow: component tests with injected callbacks, consistent with every other form component in this codebase.
