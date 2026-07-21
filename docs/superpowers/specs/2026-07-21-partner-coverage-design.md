# Partner Coverage in Rotating-Partner Doubles — Design

## Summary

Change `generateRotatingDoublesSchedule` (`lib/scheduling/rotatingDoubles.ts`) so that, as much as the tournament's round count allows, every player ends up partnering with every other player at least once — not just avoiding *repeat* partners more than necessary, which is all the current algorithm does. This is a heuristic, best-effort improvement, not a hard mathematical guarantee: organizers can still pick a `numRounds` that's too low for full coverage to be possible, and the schedule generator will not block or auto-adjust that — it will simply get as close to full coverage as the available rounds allow.

## Root Cause

`generateRotatingDoublesSchedule` currently forms each round in two independent steps: (1) randomly shuffle the players who are playing that round and chop the shuffled list into groups of 4 in order, then (2) within each *already-fixed* group of 4, pick whichever of the 3 possible team splits minimizes a partner/opponent-repeat score (`bestTeamSplit`).

The weakness is that step (1) decides group membership with no awareness of partner history at all. If two players who have never partnered end up in different groups of 4 by chance, `bestTeamSplit` never gets a chance to pair them that round — it can only optimize among the 3 splits of whatever group random shuffling produced. Over many rounds this still reduces repeats somewhat (by luck), but it doesn't drive toward full coverage, and can easily leave several pairs of players who never partner across an entire tournament even when there were mathematically enough rounds to cover them.

## Fix

Replace the "shuffle into groups of 4, then locally optimize" step with a single per-round global matching pass over all players active that round, run *before* group formation:

1. **Bye selection** (unchanged from the existing balanced-byes fix): pick `sitOutCount = playerIds.length % 4` players to sit out this round, preferring whoever has sat out fewest so far, ties broken randomly. This keeps its existing priority relative to itself, but now yields to coverage when the two goals conflict (see below).
2. **Global partner-first pairing**: among the round's active (non-bye) players, build the set of candidate pairs scored by `partnerCounts` (times already partnered) — `0` (never partnered) strictly beats any repeat count. Greedily consume pairs in ascending score order (ties broken by the seeded RNG for determinism), removing both players from the pool each time a pair is picked, until every active player is paired. This maximizes new partnerships formed this round, rather than leaving it to chance which players end up eligible to pair with which.
3. **Group formation**: combine the round's now-fixed pairs into groups of 4 (i.e., decide which pair plays against which pair) by choosing the combination that minimizes `opponentCounts` score, the same idea `bestTeamSplit` uses today, just operating on pre-formed pairs instead of raw players.
4. Update `partnerCounts` and `opponentCounts` exactly as today once pairs and groups are finalized.

**Priority when coverage and bye-balance conflict**: coverage wins. The bye-balance guarantee (max/min byes across players differ by no more than 1) may occasionally widen to within 2 when doing so is what allows a not-yet-partnered pair to finally play together. This is an intentional, small relaxation of the existing guarantee from the balanced-byes fix, in exchange for prioritizing coverage.

**No new validation, UI, or schema changes.** The tournament setup form keeps accepting any `numRounds`/`numCourts` combination unchanged; there is no coverage indicator or warning shown anywhere in the UI. When `numRounds` is below the minimum needed for full coverage, the algorithm still runs and does the best job it can (same greedy partner-first logic, just unable to finish covering every pair before rounds run out).

No changes to the function's signature or callers.

## Testing

- A case with a player count and round count where full coverage is achievable (e.g. 8 players, 7 rounds — the theoretical minimum for 8 players): assert every possible pair has partnered at least once by the end.
- A case with deliberately too few rounds for full coverage (e.g. 8 players, 3 rounds): assert the schedule still contains no duplicate partnerships where an unexplored pairing was available, i.e. it doesn't repeat a partnership while some other pair in that round could have been newly formed instead.
- Update the existing "bye counts within 1" test to "within 2" to reflect the relaxed bye-balance guarantee, and add a case demonstrating that a coverage-driven bye deviation of exactly 2 is possible without going further.
- Existing tests (group size, no double-booking within a round, determinism given the same seed) continue to hold unchanged.
