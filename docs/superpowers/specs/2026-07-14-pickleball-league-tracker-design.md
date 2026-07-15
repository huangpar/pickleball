# PickleLeague Win Tracker — Design

## Summary

A single-league pickleball tournament & standings tracker, built from four Stitch UI prototypes in `stitch_pickleball_win_tracker/` (Global Leaderboard, League Dashboard, Player Profile, Round Robin Setup). Real working app with persistence (Next.js + Neon Postgres), no login/auth, no access gate — the app is wide open to anyone with the link. Single league only (no multi-tenancy), no seasons (one running all-time history).

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Database**: Neon serverless Postgres, used for both local dev and production (no local Postgres)
- **ORM**: Drizzle ORM + `@neondatabase/serverless` driver (chosen over Prisma for serverless-friendly cold starts on Netlify)
- **Styling**: Tailwind CSS, compiled via `tailwind.config.ts` (not the CDN script the prototypes use) — theme tokens (colors, fonts, radii, spacing) ported directly from `stitch_pickleball_win_tracker/ethereal_precision/DESIGN.md`
- **Fonts**: Manrope (headlines), Inter (body), JetBrains Mono (labels/metadata) — via `next/font/google`
- **Deployment**: Netlify, using Netlify's official Next.js runtime; `DATABASE_URL` env var pointing at Neon

## Out of Scope (explicitly dropped from the prototypes)

- Login/accounts/sessions of any kind — nobody signs in, there is no per-user identity
- Any admin PIN or access gate — every page and action is open
- Multi-tenancy / multiple leagues — one league, period
- Seasons (season progress bar, season archive) — one all-time running history
- Tournament formats other than round robin
- Standalone/ad-hoc matches outside a tournament — all matches belong to a tournament
- Auto-computed ELO rating — replaced by a single manually-entered/edited DUPR-style rating per player
- Tournament Revenue dashboard widget (implies payments — out of scope)
- A dedicated global Matches page — all score entry/viewing happens on the Tournament Detail page
- Skill Progression radar (Backhand Accuracy, Serve Velocity, etc.) — invented metrics with no real data source
- Notable Achievements (Clean Sweep Award, Velocity Record, etc.) — invented badges

## Data Model

```
players
  id                uuid pk
  name              text
  dupr_rating       numeric        -- manually entered/edited, e.g. 4.5
  created_at        timestamp

tournaments
  id                      uuid pk
  name                    text
  num_courts              int
  match_duration_minutes  int
  match_format            text  -- 'singles' | 'doubles'
  team_mode               text nullable  -- 'fixed' | 'rotating', only set when match_format = 'doubles'
  num_rounds              int nullable   -- only set for doubles + team_mode = 'rotating' (admin-chosen at setup)
  status                  text  -- 'setup' | 'scheduled' | 'in_progress' | 'completed'
  created_at              timestamp

tournament_participants
  tournament_id     uuid fk -> tournaments
  player_id         uuid fk -> players
  primary key (tournament_id, player_id)

matches
  id                uuid pk
  tournament_id     uuid fk -> tournaments
  court_number      int
  round_number      int             -- which round of the round-robin (or rotating doubles) schedule
  side1_score       int nullable
  side2_score       int nullable
  status            text            -- 'scheduled' | 'final'
  played_at         timestamp nullable

match_participants
  match_id          uuid fk -> matches
  player_id         uuid fk -> players
  side              int             -- 1 or 2
  primary key (match_id, player_id)
```

`match_participants` holds 2 rows per match for singles (one per side) or 4 rows per match for doubles (two per side) — this lets both formats share the same `matches` table and the same win/loss/streak queries without a schema split. There's no separate `teams` table: for fixed-team doubles, the pairing chosen at setup is applied directly when generating each round's matches; for rotating doubles, pairings are recomputed per round and only ever exist as rows in `match_participants`.

No denormalized win/loss counters or rating-history table — wins, win %, streak, and trend are computed at read time by querying `matches` joined through `match_participants`. A doubles win/loss counts individually for both players on that side, in the same combined record as their singles results (one overall win/loss number per player, not split by format). This is fast enough at club-league scale and keeps the model simple (no risk of counters drifting out of sync).

## Match Scheduling Algorithms

Round Robin Setup gets a **Singles / Doubles** toggle (`match_format`). Doubles adds a second choice: **Fixed teams** (admin pairs participants into teams before generating) or **Rotating partners** (admin just picks participants; partners reshuffle every round).

### Singles — circle method
With N participants (add one "bye" placeholder if N is odd), fix one player and rotate the rest around them to produce N-1 (or N) rounds, each round containing floor(N/2) matches where every player appears at most once. Within each round, matches are assigned to courts in order (`court_number = match index mod num_courts`); if a round has more matches than courts, later matches in that round queue for the next available court slot. This guarantees every participant plays every other participant exactly once, matching the prototype's "Schedule Preview" (`n·(n-1)/2` total matches, estimated hours = total matches ÷ courts × match duration).

### Doubles, fixed teams — circle method at the team level
At setup, the admin groups the selected participants into 2-player teams. The same circle method above then runs treating each team as a single unit, so every team plays every other team exactly once. Total matches = `t·(t-1)/2` where `t` is the number of teams.

### Doubles, rotating partners — best-effort round shuffle
The admin sets **Number of Rounds** at setup (a reasonable default is suggested, e.g. `participants / 4` rounded, but it's editable). For each round, players are randomly split into groups of 4 (with byes if participant count isn't divisible by 4) and each group into two 2-player teams, producing one match per group. The shuffle is greedy: it tracks which pairs have already been partners and which pairs have already been opponents in prior rounds of the same tournament, and prefers combinations that minimize repeats — not a guaranteed-optimal combinatorial design, but avoids obvious repeats where alternatives exist. Matches are assigned to courts the same way as singles (`match index mod num_courts` within the round).

All matches (any format) are created with `status = 'scheduled'` when "Generate Bracket" runs. A tournament flips to `completed` once every one of its matches has `status = 'final'`.

## Pages & Navigation

Nav: `Dashboard | Tournaments | Standings | Players`

### Dashboard (`/`)
- 3 stat cards: Active Players (count of players table), Ongoing Matches (count of matches with `status = 'scheduled'` across all tournaments), Avg. Match Time (average `match_duration_minutes` across tournaments)
- Match Activity Pulse: bar chart of matches with `status = 'final'` grouped by day, last 7 days
- Top Performer: player with the best win % (minimum match-count threshold to avoid a 1-0 player topping the list)
- Recent Matches: latest final matches, plus a short upcoming/scheduled list

### Tournaments (`/tournaments`)
List of all tournaments (name, status, participant count, created date), with a "Create Tournament" button.

### Round Robin Setup (`/tournaments/new`)
- Parameters: tournament name, number of courts, match duration, Singles/Doubles toggle
- If Doubles: Fixed Teams / Rotating Partners choice; Fixed Teams adds a team-pairing step in the participants panel; Rotating Partners adds a "Number of Rounds" field (defaulted, editable)
- Participants: multi-select from existing players, plus an inline "add new player" (name + DUPR rating) for people not yet in the system
- Live Schedule Preview: participant count (or team count), total matches, estimated duration — computed per the relevant algorithm above
- "Generate Bracket" runs the appropriate scheduling algorithm and creates the tournament + participants + all matches

### Tournament Detail (`/tournaments/[id]`)
Generated schedule grouped by round and court, showing both players on each side for doubles matches. Inline score entry (single score per side) per match; entering a score sets that match to `final` and stamps `played_at`. Tournament status flips to `completed` once all matches are final.

### Standings (`/standings`)
- Sort control: **Wins** (default) or **Win %** — no DUPR-based sort
- Top-3 spotlight cards reflecting the active sort
- Full table: rank, player, DUPR rating (displayed, not sortable), wins, win %, matches played, trend arrow (based on the result of their most recent match)
- CSV export of the current table, generated client-side

### Players (`/players`)
List of all players with add/edit (name + DUPR rating). Clicking a player opens their profile.

### Player Profile (`/players/[id]`)
- DUPR rating, global rank (by Wins), win/loss record
- Match history list (all matches involving this player, across tournaments)
- Match outcome sparkline: win/loss over their last ~15 matches (replaces the prototype's Skill Progression radar)
- Highlights: current win streak, best win %, total matches played (replaces the prototype's Notable Achievements)

## Styling Notes

Avatars are always initials-only (no photo fields anywhere), rendered in a circle per the prototype's "Initials-Based Identifiers" component spec. Colors, type scale, spacing, radii, card/list/chip styles all follow `DESIGN.md` in the prototype folder verbatim.
