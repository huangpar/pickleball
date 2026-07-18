# Balanced Byes in Rotating-Partner Doubles — Design

## Summary

Fix `generateRotatingDoublesSchedule` (`lib/scheduling/rotatingDoubles.ts`) so that when a rotating-partner doubles tournament's participant count isn't evenly divisible by 4, the players who sit out each round are chosen to keep everyone's total number of byes as close to equal as possible — never off by more than 1 — instead of the current fully-random selection, which can (and does) leave some players sitting out repeatedly while others never do.

## Root Cause

Every round, `generateRotatingDoublesSchedule` shuffles the *entire* player list and takes groups of 4 from the front; the leftover `playerIds.length % 4` players at the tail of that round's shuffle sit out. Because each round's shuffle is independent of every other round, there's no memory of who has already sat out — the same player(s) can be selected as the "leftover" round after round purely by chance, while other players are never selected at all.

Singles and fixed-team doubles don't have this problem: both use the round-robin circle method (`lib/scheduling/roundRobin.ts`), which deterministically rotates one bye slot through every participant exactly once per full cycle — byes are inherently perfectly even there. This fix is scoped to rotating doubles only.

## Fix

Track a `byeCounts: Map<playerId, number>` across the whole schedule generation (not reset each round). Each round:
1. Compute `sitOutCount = playerIds.length % 4` (constant across all rounds for a given tournament).
2. Select that many players to sit out this round by randomizing tie-break order (shuffle), then stable-sorting by `byeCounts` ascending, and taking the first `sitOutCount` — i.e., whoever has sat out the *fewest* times so far is preferentially chosen to sit out now, with ties broken randomly so it's not predictable. Increment each selected player's bye count.
3. Shuffle and group the *remaining* players (now always evenly divisible by 4) into matches exactly as today, using the existing partner/opponent-repeat-minimizing logic unchanged.

This greedy "always pick from the least-loaded pool" approach is the standard technique for spreading a fixed number of events (byes) as evenly as possible across participants over any number of rounds — it guarantees the maximum and minimum bye counts across all players never differ by more than 1, which is the best achievable balance whenever `numRounds × sitOutCount` doesn't divide evenly by the player count.

No changes to the function's signature, callers, or the existing partner/opponent balancing logic — this only changes *which* players are chosen to sit out, not how matches are formed among those playing.

## Testing

- A case where byes divide evenly (e.g. 5 players, 5 rounds, 1 sit-out per round = 5 total byes): assert every player sits out exactly once.
- A case where byes don't divide evenly (e.g. 7 players, 4 rounds, 3 sit-outs per round = 12 total byes over 7 players): assert every player's bye count is within 1 of every other player's.
- Existing tests (group size, no double-booking within a round, determinism given the same seed) continue to hold unchanged.
