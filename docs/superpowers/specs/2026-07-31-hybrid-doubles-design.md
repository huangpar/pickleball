# Hybrid Doubles Team Mode — Design

## Summary

Add a third doubles `teamMode`, `"hybrid"`, sitting between the existing `"fixed"` and `"rotating"` modes. Some players are locked into a fixed partnership for the whole tournament; everyone else rotates partners round to round, same as today's rotating mode. Fixed-pair players never split and never sit out individually (their pair sits out together, or not at all). The existing rotating-partner coverage guarantee ("every player partners with every other player at least once") continues to apply, scoped to the rotating pool only — fixed-pair players are outside that guarantee by design, since their partner is locked.

## Data Model

- `tournaments.teamMode` enum gains `"hybrid"` (`schema.ts`: `text("team_mode", { enum: ["fixed", "rotating", "hybrid"] })`).
- `tournaments.numRounds` (existing column, currently used only by `rotating`) is reused for `hybrid` — hybrid needs an explicit round count for the same reason rotating does: matchups vary round to round, so there's no fixed "completes in N rounds" like all-fixed mode.
- No new tables. Fixed-pair membership is not persisted as its own record. It's submitted once at creation time (`fixedPairs` form entries, mirroring today's `fixedTeams` field) and baked directly into the generated `matches` / `matchParticipants` rows, exactly like the other two modes already work.

## Setup UI

- New `teamMode` radio option "Hybrid" alongside "Fixed Teams" / "Rotating Partners" (Doubles format only).
- When Hybrid is selected, the Participants panel supports pair-locking: clicking a player selects them (as today); clicking a second already-selected player while a first is "armed" locks the two into a fixed pair, shown with a shared badge/grouping distinct from plain-selected players. Clicking either member of a locked pair unlocks them, returning both to plain "selected".
- Anyone selected but not locked into a pair is implicitly the rotating pool — no separate toggle, consistent with how `ParticipantPicker` already treats "selected" as the source of truth for participation.
- The "Number of Rounds" input (currently shown only for Rotating) also shows for Hybrid, defaulting to 12 (see the separate default-rounds change).
- Below Participants, a "Fixed Pairs" summary list mirrors the existing "Teams (paired in selection order)" block, showing each locked pair. Rotating-pool players aren't itemized there individually (the participant list already shows who's selected).
- Submission: `formData` gets `teamMode=hybrid`, repeated `fixedPairs` entries (`"idA,idB"`, same shape as today's `fixedTeams`), and `numRounds`. All `participantIds` are sent as today (superset including fixed-pair members).

## Scheduling Algorithm

New file `lib/scheduling/hybridDoubles.ts`, exporting:

```ts
generateHybridDoublesSchedule(
  fixedPairs: [string, string][],
  rotatingPlayerIds: string[],
  numCourts: number,
  numRounds: number,
  rng: () => number = Math.random
): ScheduledMatch[]
```

Per round:

1. **Sit-out (rotating pool only):** if the rotating pool has an odd count, one rotating player sits out (fewest-byes-so-far selection, same tie-break shuffle as today's `selectSitOutPlayers`). Fixed-pair members are never in this pool and never sit out individually.
2. **Pair the rotating pool:** remaining rotating players are paired via the existing partner-coverage logic (`pairUpByPartnerCoverage`), tracked only among rotating players — fixed-pair members never enter this bookkeeping since their partner never changes. This inherits the same "everyone rotating partners everyone else rotating at least once" property established by the earlier partner-coverage feature (same greedy algorithm, same seed-dependent characteristics already documented there).
3. **Form this round's teams:** all fixed pairs (every round, unconditionally) plus this round's ad-hoc rotating pairs.
4. **Team bye:** if the combined team count is odd, one team sits out the round, chosen by lowest accumulated byes among its members. A fixed pair's bye counts as a bye for both members simultaneously, keeping them in sync.
5. **Group into matches:** remaining teams are matched via the existing opponent-coverage logic (`formGroupsFromPairs`), unchanged — it already treats "teams" as opaque pairs of player ids and needs no special-casing for fixed vs. rotating-formed pairs.
6. Court assignment and `firstServerId` exactly as today (uniform random draw from the match's own 4 players).

Since this reuses several internal helpers from `rotatingDoubles.ts` verbatim (`pairKey`, `shuffle`, `selectSitOutPlayers`, `pairUpByPartnerCoverage`, `formGroupsFromPairs`), they are extracted into a shared `lib/scheduling/pairingHelpers.ts`, imported by both `rotatingDoubles.ts` and `hybridDoubles.ts`.

## Preview & Wiring

- `lib/scheduling/preview.ts` gains:
  ```ts
  computeHybridDoublesPreview(
    fixedPairCount: number,
    rotatingPlayerCount: number,
    numCourts: number,
    matchDurationMinutes: number,
    numRounds: number
  )
  ```
  `matchesPerRound = Math.floor((fixedPairCount + Math.floor(rotatingPlayerCount / 2)) / 2)`, `totalMatches = matchesPerRound * numRounds` — same estimate-only precision the existing preview functions already have (they ignore rare bye edge cases too).
- `RoundRobinSetupForm.tsx`: `teamMode` type gains `"hybrid"`; the `preview` memo branches to the new preview function; fixed pairs are tracked in new `lockedPairs: [string, string][]` state (populated by the click-to-lock interaction); `rotatingPlayerIds` is derived as `selectedOrder` minus everyone in `lockedPairs`.
- `lib/actions/tournaments.ts` (`generateBracket`): accepts `teamMode === "hybrid"`, reads repeated `fixedPairs` form entries the same way `fixedTeams` is read today, computes `rotatingPlayerIds`, calls `generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, numCourts, numRounds, ...)`.

## Testing

- `lib/scheduling/hybridDoubles.test.ts` (mirrors `rotatingDoubles.test.ts` conventions):
  - Fixed pairs always appear together as a side across all their matches, never split.
  - Fixed-pair members never sit out unless their whole pair does.
  - Rotating-pool players achieve full partner coverage among themselves.
  - Fixed-pair players are correctly excluded from the coverage guarantee (no assertion requires them to partner anyone but their locked partner).
  - Team-level byes stay reasonably balanced.
  - No match mixes a fixed-pair member with a non-partner on the same side.
- `lib/scheduling/preview.test.ts`: add cases for `computeHybridDoublesPreview`.
- `RoundRobinSetupForm` UI tests: click-to-lock/unlock interaction, hybrid mode shows the rounds input and fixed-pairs summary, submitted `FormData` shape includes `fixedPairs` entries.
- `lib/actions/tournaments.test.ts`: hybrid end-to-end `generateBracket` creation; validation errors (0 total teams should error like other modes; odd rotating-pool count is valid).
