# Leaderboard Enhancements — Design

## Summary

Add point differential (total points scored minus points allowed) and win/loss record display to player standings. These metrics appear on both global standings and tournament-specific standings pages as additional columns alongside existing data (wins, win%, matches).

## Scope

- **New metrics:** Point differential and win/loss record (formatted as "5W-2L")
- **Display locations:** Global standings page and per-tournament standings pages
- **Presentation:** Additional columns on desktop; compressed format on mobile
- **Interaction:** Display-only (not sortable)
- **Data:** No schema changes; computed from existing match scores

## Data Layer

### Type Changes

Update `StandingRow` interface in `lib/standings.ts`:

```ts
export interface StandingRow {
  id: string;
  name: string;
  wins: number;
  losses: number;                // NEW: total losses
  matchesPlayed: number;
  winPercentage: number;
  pointDifferential: number;     // NEW: total points scored - points allowed
  trend: "up" | "down" | "flat";
}
```

### Calculations

**Losses:**
```
losses = matchesPlayed - wins
```

**Point Differential:**
```
pointDifferential = sum of (player's total points - opponent's total points) for all finalized matches
```

For each match where the player participated:
- If player was on side1: (side1Score - side2Score)
- If player was on side2: (side2Score - side1Score)
- Only include matches with status "final" (side1Score and side2Score populated)
- Unfinished matches are excluded

### Data Fetching

**Global standings** (`lib/data/standings.ts` → `getStandings()`):
- Compute wins and losses from match outcomes
- Compute pointDifferential by iterating completed matches and summing differentials
- Existing trend and winPercentage calculations unchanged

**Tournament standings** (`lib/data/tournamentStandings.ts` → `getTournamentStandings()`):
- Apply same calculations scoped to matches within a single tournament
- Same logic for losses and pointDifferential

## UI & Components

### Desktop Table Layout

**Column order:**
| Rank | Player | Wins | W-L Record | Win % | Point Diff | Matches | Trend |

**Formatting:**
- W-L Record: "5W-2L" (bold or semibold)
- Point Diff: "+47" (green text) or "-12" (red text) or "0" (gray text)
- Existing columns unchanged

**File:** `components/standings/StandingsTable.tsx` (StandingsTable component, desktop path starting line 58)

### Mobile Card Layout

**Existing format preserved:**
```
Rank | Player name (with avatar)     Trend
     Subtitle: Wins + NEW metrics   Value: Wins
```

Updated subtitle to include new metrics in compressed form:
```
5W-2L · +47 · ↑
```

The right-side value still shows wins, but the subtitle now reads: "W-L Record · Point Diff · Trend"

**File:** `components/standings/StandingsTable.tsx` (mobile path starting line 90)

### Tournament Standings

Apply the same column additions to `components/tournaments/TournamentStandingsTable.tsx`:
- Same desktop table columns as global standings
- Same mobile card layout
- Scoped to tournament participants only

## Success Criteria

- ✅ Point differential correctly calculated (total points in - total points out)
- ✅ Win/loss record displays as "5W-2L" format
- ✅ Metrics appear on both global and tournament standings
- ✅ Desktop table renders with new columns, mobile cards use compressed format
- ✅ Color coding applied to point differential (green/red/gray)
- ✅ All existing metrics (wins, win%, matches, trend) remain unchanged and visible
- ✅ No regressions to existing standings functionality
- ✅ Tests verify calculations for edge cases (unfinished matches, zero scores)

## Testing

**Data calculation tests** (`lib/data/standings.test.ts`, `lib/data/tournamentStandings.test.ts`):
- Verify losses = matchesPlayed - wins
- Verify pointDifferential correctly sums per-match differentials
- Verify unfinished matches excluded from point differential
- Verify zero differential handled correctly

**Component tests** (`components/standings/StandingsTable.test.tsx`):
- Verify W-L Record column renders with correct format
- Verify Point Diff column renders with color coding
- Verify mobile card subtitle includes compressed metrics
- Verify tournament standings component renders new columns

## Notes

- Match scores must be populated when match status is set to "final"; the enhancement assumes this data exists
- Point differential is tournament-agnostic for global standings (sums across all tournaments)
- Point differential is tournament-scoped for per-tournament standings
- Trend calculation remains based on recent match outcomes (unchanged)
