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
  status                  text  -- 'setup' | 'scheduled' | 'in_progress' | 'completed'
  created_at              timestamp

tournament_participants
  tournament_id     uuid fk -> tournaments
  player_id         uuid fk -> players
  primary key (tournament_id, player_id)

matches
  id                uuid pk
  tournament_id     uuid fk -> tournaments
  player1_id        uuid fk -> players
  player2_id        uuid fk -> players
  court_number      int
  round_number      int             -- which round of the round-robin rotation
  player1_score     int nullable
  player2_score     int nullable
  status            text            -- 'scheduled' | 'final'
  played_at         timestamp nullable
```

No denormalized win/loss counters or rating-history table — win %, wins, streak, and trend are computed at read time by querying `matches`. This is fast enough at club-league scale and keeps the model simple (no risk of counters drifting out of sync).

## Round-Robin Scheduling Algorithm

Standard **circle method**: with N participants (add one "bye" placeholder if N is odd), fix one player and rotate the rest around them to produce N-1 (or N) rounds, each round containing floor(N/2) matches where every player appears at most once. Within each round, matches are assigned to courts in order (`court_number = match index mod num_courts`); if a round has more matches than courts, later matches in that round queue for the next available court slot. This guarantees every participant plays every other participant exactly once, matching the prototype's "Schedule Preview" (`n·(n-1)/2` total matches, estimated hours = total matches ÷ courts × match duration).

All matches are created with `status = 'scheduled'` when "Generate Bracket" runs. A tournament flips to `completed` once every one of its matches has `status = 'final'`.

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
- Parameters: tournament name, number of courts, match duration
- Participants: multi-select from existing players, plus an inline "add new player" (name + DUPR rating) for people not yet in the system
- Live Schedule Preview: participant count, total matches (`n·(n-1)/2`), estimated duration
- "Generate Bracket" runs the round-robin algorithm above and creates the tournament + participants + all matches

### Tournament Detail (`/tournaments/[id]`)
Generated schedule grouped by round and court. Inline score entry (single score per side) per match; entering a score sets that match to `final` and stamps `played_at`. Tournament status flips to `completed` once all matches are final.

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
