# Doubles Partner Stats on Player Profile — Design

## Summary

On a player's profile page, let the viewer pick one of that player's past doubles partners from a dropdown and see that partnership's win/loss record, broken down by which specific opposing team they faced. Covers all doubles history (fixed-team and rotating-partner tournaments alike), all-time.

## Data Layer

New file `lib/data/partnerBreakdown.ts`:

```ts
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

export async function getPlayerPartnerBreakdown(playerId: string): Promise<PartnerBreakdown[]>
```

Built entirely on top of the existing `getPlayerMatchHistory(playerId)` (`lib/data/matchHistory.ts`) — no new database queries. That function already returns every final match for a player with `partnerNames`, `opponentNames`, and `won` correctly computed via the existing `matchParticipants`/`matches`/`tournaments` joins.

`getPlayerPartnerBreakdown` post-processes that result:
1. Filters to entries where `partnerNames.length > 0` — singles matches have no partner and are excluded automatically (their `partnerNames` array is always empty).
2. Groups the remaining entries by partner name. Both fixed-team and rotating-partner doubles always have exactly one partner per match, so `partnerNames[0]` is the group key.
3. Within each partner group, further groups by the sorted, joined opponent-team name (e.g. `"Ben Rivera & Carla Diaz"`) and tallies wins/losses for each distinct opposing pair.
4. Emits one `PartnerBreakdown` per partner: aggregate `wins`/`losses`/`winPercentage` across all matches with that partner, plus the `opponents` array of per-opposing-team records.

Reusing `getPlayerMatchHistory` means this feature covers exactly the same match set (all tournaments, all-time, both team modes) that the existing Match History section already shows, with no risk of drifting out of sync with it.

## Display

New client component `components/players/PartnerBreakdown.tsx`, added to `app/players/[id]/page.tsx` below the existing Match History card:

- A `<select>` listing every partner name from the fetched breakdown, alphabetically, with a placeholder option `"Select a partner…"`. Nothing else renders until the viewer picks one.
- Once a partner is selected: an overall line — `Overall with {partnerName}: {wins}-{losses} · {winPercentage}%` — followed by a list of opponent-team rows, each showing `{opponentNames.join(" & ")}: {wins}-{losses}`, sorted alphabetically by the opponent-team name.
- If `getPlayerPartnerBreakdown` returns an empty array (player has no doubles history), the entire section is omitted from the page — consistent with how the page already omits sections with nothing to show.

All data for every partner is fetched once, server-side, and passed as a single prop; switching the selected partner in the dropdown is pure client-side state with no additional server round-trip, since the full per-player breakdown is small at this app's scale.

`app/players/[id]/page.tsx` calls `getPlayerPartnerBreakdown(player.id)` alongside its existing `Promise.all` of `getPlayerMatchOutcomes`/`getPlayerMatchHistory`/`getStandings`, and passes the result to `<PartnerBreakdown breakdown={...} />`.

## Testing

- `partnerBreakdown.test.ts` (real-DB pattern, matching the existing `matchHistory.test.ts` insert/cleanup convention):
  - One partner, repeated matchups against the same opponent team: record accumulates correctly (wins/losses sum, not overwritten).
  - One partner, two different opponent teams: breakdown correctly splits into two separate `opponents` entries.
  - Two different partners: grouped into two separate `PartnerBreakdown` entries, each with its own correct `opponents` breakdown.
  - No doubles history (only singles matches, or no matches at all): returns `[]`.
- `PartnerBreakdown.test.tsx` (RTL):
  - Renders the dropdown populated with partner names from the prop.
  - Selecting a partner shows the correct overall line and the correct opponent-team rows.
  - Renders nothing when passed an empty `breakdown` array.
