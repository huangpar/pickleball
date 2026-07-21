# Serve-First Indicator — Design

## Summary

Show which specific player serves first on every match, across all match formats (singles, fixed-team doubles, rotating doubles). The first server is chosen at random — uniformly among the match's actual participants — when the schedule is generated, and displayed inline next to that player's name wherever match scores are shown.

## Data Model

Add a nullable `firstServerId` column to `matches`, referencing `players.id`:

```ts
firstServerId: uuid("first_server_id").references(() => players.id),
```

Generated via `npx drizzle-kit generate` (this project's existing schema-change workflow — schema edit, then a generated `.sql` migration + snapshot under `drizzle/`, no hand-written SQL).

Nullable, and **no backfill** for matches created before this migration ships: there's no real record of who actually served first in an already-scheduled or already-played match, so those simply show no indicator going forward. This mirrors how prior schema additions in this project (e.g. `tournaments.startedAt`) were introduced without backfilling historical rows.

## Scheduling

`ScheduledMatch` (`lib/scheduling/types.ts`) gains:

```ts
export interface ScheduledMatch {
  roundNumber: number;
  courtNumber: number;
  side1PlayerIds: string[];
  side2PlayerIds: string[];
  firstServerId: string;
}
```

All three schedule generators set `firstServerId` by picking uniformly at random from the match's combined participant list (`[...side1PlayerIds, ...side2PlayerIds]`) using a seeded `rng`. This gives every player in the match an equal chance to open serve, regardless of side or doubles partnership — for a 2-player singles match that's a 50/50 coin flip; for a 4-player doubles match, each of the 4 players has an equal 1-in-4 chance (which is the same as picking a side 50/50 and then a partner within that side 50/50).

`generateRotatingDoublesSchedule` already threads an `rng: () => number = Math.random` parameter and reuses its existing per-round RNG draw. `generateSinglesSchedule` and `generateFixedDoublesSchedule` currently take no `rng` (they're pure deterministic round-robin rotations) — this adds `rng: () => number = Math.random` as a new trailing parameter to both, matching the existing default-parameter convention, and both draw one `rng()` call per match to pick the first server.

## Wiring

- `generateBracket` (`lib/actions/tournaments.ts`): the single call site that inserts rows into `matches` includes `firstServerId: scheduledMatch.firstServerId` in the insert values.
- `getTournamentDetail` (`lib/data/tournamentDetail.ts`): `MatchDetail` gains `firstServerName: string | null`, resolved by joining `matches.firstServerId` to the corresponding player's name (already-loaded via the existing `participantsByMatch` join data — no extra query needed, since the first server is always one of the match's own participants). `null` when `firstServerId` is `null` (pre-migration matches).

## Display

`MatchScoreForm` (`components/tournaments/MatchScoreForm.tsx`) gains a `firstServerName: string | null` prop. In both the editable (score-entry) and disabled (locked, post-tournament-end) states, whichever row's player name matches `firstServerName` gets a small inline label appended to the name — e.g. `Alex & Sam · Alex serves first` — rather than a separate line, keeping the existing stacked per-side row layout unchanged. When `firstServerName` is `null`, no label appears anywhere on the match card, identical to today's rendering.

`app/tournaments/[id]/page.tsx` passes `match.firstServerName` through to `MatchScoreForm` alongside the existing props.

## Testing

- `singles.test.ts` / `fixedDoubles.test.ts`: new tests asserting `firstServerId` is always one of the match's own participant ids, and (given a seeded RNG across a multi-match schedule) that it isn't pinned to the same position (e.g. always `side1PlayerIds[0]`) every time.
- `rotatingDoubles.test.ts`: same participant-membership assertion, reusing the existing seeded-RNG test pattern.
- `tournamentDetail.test.ts`: a case verifying `firstServerName` resolves to the correct player's name, and a case with a `null` `firstServerId` (simulating a pre-migration match) resolving to `firstServerName: null` without throwing.
- `MatchScoreForm.test.tsx`: a rendering test asserting the "serves first" label appears next to the correct player in both the editable and disabled states, and is absent entirely when `firstServerName` is `null`.
