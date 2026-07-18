# Mobile Optimization — Design

## Summary

Fix the concrete mobile-usability problems found by testing every page at a 375px viewport: the top nav clips items off-screen, the Standings tables (global and per-tournament) overflow horizontally with no way to reach the hidden columns, and two page headers don't stack a long title away from an adjacent button. One consistent breakpoint (Tailwind's `md`, 768px) governs all of it — below `md` is "mobile," at `md` and above the app looks exactly as it does today.

This builds on, rather than replaces, the mobile-friendly work already checkpointed in this repo (the `Tabs` component and its use on Tournament Detail, the responsive `grid-cols-1 md:grid-cols-N` patterns already on the Dashboard and Player Profile).

## Out of Scope

- Touch target sizing beyond what the new bottom nav / card layouts naturally provide — no separate audit.
- Any page not identified as broken during testing (Dashboard, Player Profile, Players list, Round Robin Setup's overall structure, the Tabs-based Tournament Detail rounds view) — these already hold up at 375px and aren't touched.
- A "reopen tournament" or other unrelated feature work.

## Global Nav: Bottom Tab Bar

Below `md` (768px): the current top nav's link row (`Dashboard | Tournaments | Standings | Players`) is replaced by a new fixed bottom tab bar — text-only labels (no icons, matching this app's icon-free typographic style everywhere else), same 4 items in the same order, active tab gets the same highlighted-background treatment the top nav already uses. The top bar itself doesn't disappear — it shrinks to just the "Shaughnessy Pickleball" brand link, so there's still a page identity/home-link at the top.

At `md` and above: today's full top bar (brand + all 4 links) is unchanged, and the bottom tab bar never renders.

**Architecture:**
- Extract the shared `NAV_ITEMS` array and active-path logic out of `components/Nav.tsx` into a small shared module (`components/navItems.ts`) so `Nav.tsx` and the new `components/BottomNav.tsx` don't duplicate it.
- `components/Nav.tsx`: wrap the link row in `hidden md:flex` (hidden below `md`, flex at `md`+); brand link is unaffected.
- `components/BottomNav.tsx` (new): fixed to the bottom of the viewport, `md:hidden` (visible below `md` only), same 4 nav items, same active-highlight styling as the top nav.
- `app/layout.tsx`: render `<BottomNav />` alongside the existing `<Nav />`, and add bottom padding to `<body>` below `md` (e.g. `pb-16 md:pb-0`) so page content never sits underneath the fixed bar.

## Standings Tables: Card View Below `md`

Both `components/standings/StandingsTable.tsx` (global Standings page) and `components/tournaments/TournamentStandingsTable.tsx` (per-tournament leaderboard) get a second, card-based representation of the same rows, shown only below `md`; the existing `<table>` markup is unchanged and shown only at `md` and above. This is a pure CSS swap (`hidden md:block` on the table wrapper, `md:hidden` on the new card list) — no JavaScript, no duplicated data-fetching, both representations render from the exact same sorted row data already being passed in.

Each mobile card shows: rank + avatar + name on one line, then wins/win % (and matches, for the global table) as compact secondary text below. The global table's card additionally shows DUPR rating and trend arrow as small secondary text (kept, just de-emphasized) since that page's spec calls for all of those fields; the per-tournament table's card omits nothing since its desktop table already only has Rank/Player/Wins/Win %/Matches.

## Minor Layout Fixes

- `app/tournaments/page.tsx` (Tournaments list) and `app/tournaments/[id]/page.tsx` (Tournament Detail) page headers: change the title-row wrapper from `flex items-center justify-between` to `flex flex-col gap-4 md:flex-row md:items-center md:justify-between`, so a long title stacks above its button/badge below `md` instead of crowding it.
- `components/tournaments/ParticipantPicker.tsx`: change the participant grid from a fixed `grid-cols-2` to `grid-cols-1 md:grid-cols-2`, so names and DUPR ratings aren't cramped on narrow screens.

## Testing

jsdom (this repo's test environment) doesn't evaluate CSS media queries, so component tests can't assert which representation is *visually* shown at a given width — they can only assert that both representations exist in the rendered output with the correct responsive classes. Each changed component gets a test confirming that structural claim (e.g., both the mobile card list and the desktop table are present in the DOM, each behind its expected `hidden`/`md:*` class). The actual responsive behavior is confirmed the same way the rest of this app's UI work has been verified — manually, in a real browser resized to a mobile width, as the last step of the implementation plan.
