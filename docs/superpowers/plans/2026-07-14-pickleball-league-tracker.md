# PickleLeague Win Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real, persisted, single-league pickleball tournament & standings tracker (Dashboard, Tournaments/Round-Robin Setup, Standings, Players/Profile) from the four Stitch UI prototypes, with no login and support for singles and doubles (fixed or rotating-partner) round robins.

**Architecture:** Next.js (App Router, TypeScript) single app, Drizzle ORM against Neon serverless Postgres (same database for dev and prod), Tailwind compiled from the prototype's design tokens. Pure scheduling and stats logic lives in framework-free `lib/` modules with unit tests (Vitest); pages are server components that call these modules plus thin server actions for mutations.

**Tech Stack:** Next.js 14+ (App Router) · TypeScript · Drizzle ORM · `@neondatabase/serverless` · Tailwind CSS · Vitest + @testing-library/react · Netlify (Next.js runtime)

## Global Constraints

- No login, accounts, sessions, or access gate of any kind — every page and action is open (spec: Out of Scope).
- Single league only, no multi-tenancy, no seasons — one all-time running history (spec: Summary, Out of Scope).
- All matches belong to a tournament; no standalone/ad-hoc matches; no dedicated global Matches page — score entry lives on Tournament Detail (spec: Out of Scope, Pages & Navigation).
- DUPR rating is a manually-entered/edited numeric field on `players`, never auto-computed (spec: Out of Scope, Data Model).
- Avatars are always initials-only — no photo fields, no placeholder images anywhere (spec: Styling Notes).
- Nav is exactly `Dashboard | Tournaments | Standings | Players` (spec: Pages & Navigation).
- Standings sorts by **Wins** (default) or **Win %** only — never by DUPR rating (spec: Standings section).
- Styling tokens (colors, fonts, radii, spacing) are ported verbatim from `stitch_pickleball_win_tracker/ethereal_precision/DESIGN.md`; Tailwind is compiled via `tailwind.config.ts`, not the prototypes' CDN script (spec: Tech Stack, Styling Notes).
- Database: Neon serverless Postgres used for both local dev and production, via Drizzle + `@neondatabase/serverless` (spec: Tech Stack).
- Deployment target: Netlify, using Netlify's official Next.js runtime (spec: Tech Stack).

---

## Task 1: Scaffold Next.js app with the Ethereal Precision design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `.env.local` (untracked), `.env.example`
- Create: `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`
- Create: `app/layout.tsx`, `app/page.tsx` (temporary placeholder, replaced in Task 15)
- Create: `vitest.config.ts`, `lib/testSetup.ts`

**Interfaces:**
- Produces: a running `next dev` server on port 3000 rendering a themed placeholder page; a `vitest` command that can run unit tests; Tailwind theme tokens (`bg-surface`, `text-on-surface`, `font-headline`, etc.) available to every later component/page task.

- [ ] **Step 1: Initialize the Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --no-turbopack
```
When prompted about a non-empty directory (this repo already has `.git` and `docs/`), confirm to proceed in the current directory.

- [ ] **Step 2: Install additional dependencies**

Run:
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/node dotenv
```

- [ ] **Step 3: Replace `tailwind.config.ts` with the Ethereal Precision design tokens**

Read `stitch_pickleball_win_tracker/ethereal_precision/DESIGN.md` (in the additional working directory `C:\Users\parke\Downloads\stitch_pickleball_win_tracker`) for the source of truth. Write:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "on-tertiary-container": "#9ca0a2",
        "surface-dim": "#ccdbf4",
        "surface-container": "#e5eeff",
        error: "#ba1a1a",
        primary: "#182232",
        "surface-container-highest": "#d4e4fc",
        "on-tertiary-fixed-variant": "#434749",
        "on-surface-variant": "#45474c",
        "surface-tint": "#555f71",
        "tertiary-fixed-dim": "#c3c7c9",
        "on-primary-container": "#96a0b5",
        background: "#f8f9ff",
        "on-error-container": "#93000a",
        "inverse-primary": "#bdc7dc",
        "on-secondary-container": "#28705b",
        "on-tertiary": "#ffffff",
        "outline-variant": "#c5c6cd",
        "tertiary-fixed": "#e0e3e5",
        "secondary-fixed": "#a9f1d7",
        "on-tertiary-fixed": "#181c1e",
        "surface-container-high": "#dce9ff",
        "on-background": "#0d1c2e",
        "primary-container": "#2d3748",
        "surface-container-low": "#eff4ff",
        "on-secondary": "#ffffff",
        "inverse-on-surface": "#eaf1ff",
        "primary-fixed-dim": "#bdc7dc",
        "on-primary": "#ffffff",
        "inverse-surface": "#223144",
        "error-container": "#ffdad6",
        "tertiary-container": "#333739",
        outline: "#75777d",
        "on-primary-fixed": "#121c2c",
        "on-primary-fixed-variant": "#3d4759",
        "secondary-fixed-dim": "#8ed5bc",
        "on-secondary-fixed": "#002118",
        "on-surface": "#0d1c2e",
        "primary-fixed": "#d9e3f9",
        secondary: "#206a56",
        tertiary: "#1e2223",
        "surface-container-lowest": "#ffffff",
        "secondary-container": "#a9f1d7",
        "on-error": "#ffffff",
        surface: "#f8f9ff",
        "on-secondary-fixed-variant": "#00513f",
        "surface-variant": "#d4e4fc",
        "surface-bright": "#f8f9ff",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        "margin-mobile": "16px",
        "container-max": "1280px",
        "margin-desktop": "40px",
        gutter: "24px",
        base: "8px",
      },
      fontFamily: {
        headline: ["var(--font-manrope)"],
        body: ["var(--font-inter)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Wire up fonts and the root layout**

Write `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-manrope" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "PickleLeague",
  description: "Single-league pickleball tournament & standings tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-surface text-on-surface font-body min-h-screen">{children}</body>
    </html>
  );
}
```

Replace `app/page.tsx` with a temporary placeholder (Task 15 replaces this with the real Dashboard):
```tsx
export default function Home() {
  return (
    <main className="p-gutter">
      <h1 className="font-headline text-3xl font-bold">PickleLeague</h1>
      <p className="font-body text-on-surface-variant">Scaffold OK.</p>
    </main>
  );
}
```

- [ ] **Step 5: Configure Vitest**

Write `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./lib/testSetup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
});
```

Write `lib/testSetup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the scaffold runs**

Run: `npm run dev` (then stop it with Ctrl+C once confirmed) — expected: server starts on `http://localhost:3000` with no build errors.

Run: `npm run test` — expected: "No test files found" message (not an error), confirming Vitest is wired up correctly.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Ethereal Precision design tokens"
```

---

## Task 2: Neon database connection and Drizzle schema

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/client.ts`
- Create: `drizzle.config.ts`
- Modify: `.env.example`, `.env.local` (add `DATABASE_URL`)
- Test: `lib/db/schema.smoke.test.ts`

**Interfaces:**
- Produces: `players`, `tournaments`, `tournamentParticipants`, `matches`, `matchParticipants` Drizzle table objects exported from `lib/db/schema.ts`; a `db` Drizzle client exported from `lib/db/client.ts` (`import { db } from "@/lib/db/client"`). Every later task that touches the database imports from these two files.

- [ ] **Step 1: Add the Neon connection string**

Ask the user for their Neon `DATABASE_URL` (postgresql://... from the Neon console) if not already available, and add it to `.env.local`:
```
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
```
Add a placeholder to `.env.example`:
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```
Confirm `.env.local` is listed in `.gitignore` (it is, by default, from `create-next-app`).

- [ ] **Step 2: Write the Drizzle schema**

```ts
// lib/db/schema.ts
import { pgTable, uuid, text, integer, numeric, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  duprRating: numeric("dupr_rating", { precision: 3, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  numCourts: integer("num_courts").notNull(),
  matchDurationMinutes: integer("match_duration_minutes").notNull(),
  matchFormat: text("match_format", { enum: ["singles", "doubles"] }).notNull(),
  teamMode: text("team_mode", { enum: ["fixed", "rotating"] }),
  numRounds: integer("num_rounds"),
  status: text("status", { enum: ["setup", "scheduled", "in_progress", "completed"] })
    .notNull()
    .default("setup"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournamentParticipants = pgTable(
  "tournament_participants",
  {
    tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
    playerId: uuid("player_id").notNull().references(() => players.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tournamentId, t.playerId] }) })
);

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  courtNumber: integer("court_number").notNull(),
  roundNumber: integer("round_number").notNull(),
  side1Score: integer("side1_score"),
  side2Score: integer("side2_score"),
  status: text("status", { enum: ["scheduled", "final"] }).notNull().default("scheduled"),
  playedAt: timestamp("played_at"),
});

export const matchParticipants = pgTable(
  "match_participants",
  {
    matchId: uuid("match_id").notNull().references(() => matches.id),
    playerId: uuid("player_id").notNull().references(() => players.id),
    side: integer("side").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.matchId, t.playerId] }) })
);
```

- [ ] **Step 3: Write the Drizzle client**

```ts
// lib/db/client.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 4: Configure drizzle-kit and generate the migration**

```ts
// drizzle.config.ts
import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

Run: `npx drizzle-kit generate` — expected: creates `drizzle/0000_*.sql` with `CREATE TABLE` statements for all 5 tables.

Run: `npx drizzle-kit push` — expected: applies the schema directly to the Neon database, output confirms tables created.

- [ ] **Step 5: Write and run a smoke test against the real Neon database**

```ts
// lib/db/schema.smoke.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "./client";
import { players } from "./schema";
import { eq } from "drizzle-orm";

describe("db smoke test", () => {
  const testName = "__smoke_test_player__";

  afterAll(async () => {
    await db.delete(players).where(eq(players.name, testName));
  });

  it("inserts and reads back a player", async () => {
    const [inserted] = await db
      .insert(players)
      .values({ name: testName, duprRating: "3.50" })
      .returning();
    expect(inserted.name).toBe(testName);

    const rows = await db.select().from(players).where(eq(players.name, testName));
    expect(rows).toHaveLength(1);
    expect(rows[0].duprRating).toBe("3.50");
  });
});
```

Run: `npm run test -- lib/db/schema.smoke.test.ts` — expected: 1 passed. This confirms the live Neon connection, schema, and client all work end to end.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Drizzle schema and Neon client, apply initial migration"
```

---

## Task 3: Pure round-robin pairing core

**Files:**
- Create: `lib/scheduling/roundRobin.ts`
- Test: `lib/scheduling/roundRobin.test.ts`

**Interfaces:**
- Produces: `roundRobinRounds<T>(items: T[]): { side1: T; side2: T }[][]` — pure, framework-free, no DB/UUIDs involved (works on any item type via generics). Task 4 imports this directly.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/scheduling/roundRobin.test.ts
import { describe, it, expect } from "vitest";
import { roundRobinRounds } from "./roundRobin";

describe("roundRobinRounds", () => {
  it("pairs every item with every other item exactly once for an even count", () => {
    const rounds = roundRobinRounds(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3); // n - 1 rounds

    const seenPairs = new Set<string>();
    rounds.forEach((round) => {
      const seenThisRound = new Set<string>();
      round.forEach(({ side1, side2 }) => {
        expect(seenThisRound.has(side1)).toBe(false);
        expect(seenThisRound.has(side2)).toBe(false);
        seenThisRound.add(side1);
        seenThisRound.add(side2);
        seenPairs.add([side1, side2].sort().join("|"));
      });
    });

    // C(4,2) = 6 unique pairs total
    expect(seenPairs.size).toBe(6);
  });

  it("adds a bye for an odd count so nobody is scheduled twice in a round", () => {
    const rounds = roundRobinRounds(["A", "B", "C"]);
    expect(rounds).toHaveLength(3); // (n rounded up to even) - 1 = 3

    rounds.forEach((round) => {
      const players = round.flatMap((m) => [m.side1, m.side2]);
      expect(new Set(players).size).toBe(players.length); // no duplicates within a round
      expect(round.length).toBeLessThanOrEqual(1); // 3 players -> at most 1 match per round
    });

    const seenPairs = new Set<string>();
    rounds.forEach((round) => round.forEach(({ side1, side2 }) => seenPairs.add([side1, side2].sort().join("|"))));
    expect(seenPairs.size).toBe(3); // C(3,2) = 3 unique pairs
  });

  it("returns no rounds for fewer than 2 items", () => {
    expect(roundRobinRounds(["A"])).toEqual([]);
    expect(roundRobinRounds([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/scheduling/roundRobin.test.ts` — expected: FAIL with "Cannot find module './roundRobin'".

- [ ] **Step 3: Implement `roundRobinRounds`**

```ts
// lib/scheduling/roundRobin.ts
export function roundRobinRounds<T>(items: T[]): { side1: T; side2: T }[][] {
  if (items.length < 2) return [];

  const arr: (T | null)[] = [...items];
  if (arr.length % 2 !== 0) arr.push(null);

  const n = arr.length;
  const numRounds = n - 1;
  const half = n / 2;
  const rounds: { side1: T; side2: T }[][] = [];

  let current = [...arr];
  for (let r = 0; r < numRounds; r++) {
    const pairs: { side1: T; side2: T }[] = [];
    for (let i = 0; i < half; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a !== null && b !== null) {
        pairs.push({ side1: a, side2: b });
      }
    }
    rounds.push(pairs);

    const fixed = current[0];
    const rest = current.slice(1);
    const last = rest.pop() as T | null;
    rest.unshift(last);
    current = [fixed, ...rest];
  }

  return rounds;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/scheduling/roundRobin.test.ts` — expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/scheduling/roundRobin.ts lib/scheduling/roundRobin.test.ts
git commit -m "Add pure round-robin pairing core"
```

---

## Task 4: Singles and fixed-team doubles schedule generators

**Files:**
- Create: `lib/scheduling/types.ts`
- Create: `lib/scheduling/singles.ts`
- Create: `lib/scheduling/fixedDoubles.ts`
- Test: `lib/scheduling/singles.test.ts`
- Test: `lib/scheduling/fixedDoubles.test.ts`

**Interfaces:**
- Consumes: `roundRobinRounds` from `lib/scheduling/roundRobin.ts` (Task 3).
- Produces: `ScheduledMatch` type; `generateSinglesSchedule(playerIds: string[], numCourts: number): ScheduledMatch[]`; `generateFixedDoublesSchedule(teams: [string, string][], numCourts: number): ScheduledMatch[]`. Task 12 (Round Robin Setup / Generate Bracket action) imports both generators and the `ScheduledMatch` type.

- [ ] **Step 1: Write the shared `ScheduledMatch` type**

```ts
// lib/scheduling/types.ts
export interface ScheduledMatch {
  roundNumber: number;
  courtNumber: number;
  side1PlayerIds: string[];
  side2PlayerIds: string[];
}
```

- [ ] **Step 2: Write the failing tests for singles**

```ts
// lib/scheduling/singles.test.ts
import { describe, it, expect } from "vitest";
import { generateSinglesSchedule } from "./singles";

describe("generateSinglesSchedule", () => {
  it("schedules every pair exactly once across n-1 rounds, 1 player per side", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const schedule = generateSinglesSchedule(players, 2);

    expect(schedule).toHaveLength(6); // C(4,2)
    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(1);
      expect(m.side2PlayerIds).toHaveLength(1);
    });

    const rounds = new Set(schedule.map((m) => m.roundNumber));
    expect(rounds.size).toBe(3);
  });

  it("distributes matches across courts within a round, starting from court 1", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const schedule = generateSinglesSchedule(players, 2);
    const round1 = schedule.filter((m) => m.roundNumber === 1);
    expect(round1).toHaveLength(3); // 6 players -> 3 matches per round
    expect(round1.map((m) => m.courtNumber).sort()).toEqual([1, 1, 2]); // 3 matches, 2 courts -> court reused
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- lib/scheduling/singles.test.ts` — expected: FAIL with "Cannot find module './singles'".

- [ ] **Step 4: Implement `generateSinglesSchedule`**

```ts
// lib/scheduling/singles.ts
import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateSinglesSchedule(playerIds: string[], numCourts: number): ScheduledMatch[] {
  const rounds = roundRobinRounds(playerIds);
  const schedule: ScheduledMatch[] = [];

  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      schedule.push({
        roundNumber: roundIndex + 1,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: [pair.side1],
        side2PlayerIds: [pair.side2],
      });
    });
  });

  return schedule;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- lib/scheduling/singles.test.ts` — expected: 2 passed.

- [ ] **Step 6: Write the failing tests for fixed-team doubles**

```ts
// lib/scheduling/fixedDoubles.test.ts
import { describe, it, expect } from "vitest";
import { generateFixedDoublesSchedule } from "./fixedDoubles";

describe("generateFixedDoublesSchedule", () => {
  it("schedules every team against every other team exactly once, 2 players per side", () => {
    const teams: [string, string][] = [
      ["p1", "p2"],
      ["p3", "p4"],
      ["p5", "p6"],
      ["p7", "p8"],
    ];
    const schedule = generateFixedDoublesSchedule(teams, 2);

    expect(schedule).toHaveLength(6); // C(4,2) team pairings
    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
    });

    // team ["p1","p2"] should appear together on the same side every time it plays
    schedule.forEach((m) => {
      if (m.side1PlayerIds.includes("p1")) expect(m.side1PlayerIds).toContain("p2");
      if (m.side2PlayerIds.includes("p1")) expect(m.side2PlayerIds).toContain("p2");
    });
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npm run test -- lib/scheduling/fixedDoubles.test.ts` — expected: FAIL with "Cannot find module './fixedDoubles'".

- [ ] **Step 8: Implement `generateFixedDoublesSchedule`**

```ts
// lib/scheduling/fixedDoubles.ts
import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateFixedDoublesSchedule(
  teams: [string, string][],
  numCourts: number
): ScheduledMatch[] {
  const teamIndices = teams.map((_, i) => i);
  const rounds = roundRobinRounds(teamIndices);
  const schedule: ScheduledMatch[] = [];

  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      schedule.push({
        roundNumber: roundIndex + 1,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: [...teams[pair.side1]],
        side2PlayerIds: [...teams[pair.side2]],
      });
    });
  });

  return schedule;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run test -- lib/scheduling/fixedDoubles.test.ts` — expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add lib/scheduling/types.ts lib/scheduling/singles.ts lib/scheduling/fixedDoubles.ts lib/scheduling/singles.test.ts lib/scheduling/fixedDoubles.test.ts
git commit -m "Add singles and fixed-team doubles schedule generators"
```

---

## Task 5: Rotating-partner doubles schedule generator

**Files:**
- Create: `lib/scheduling/rotatingDoubles.ts`
- Test: `lib/scheduling/rotatingDoubles.test.ts`

**Interfaces:**
- Produces: `generateRotatingDoublesSchedule(playerIds: string[], numCourts: number, numRounds: number, rng?: () => number): ScheduledMatch[]`. Task 12 imports this alongside the Task 4 generators.

- [ ] **Step 1: Write the failing tests**

Use a seeded RNG so the test is deterministic — a tiny mulberry32 implementation inlined in the test file.

```ts
// lib/scheduling/rotatingDoubles.test.ts
import { describe, it, expect } from "vitest";
import { generateRotatingDoublesSchedule } from "./rotatingDoubles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateRotatingDoublesSchedule", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

  it("produces 2 matches per round for 8 players (groups of 4), 4 distinct players per match", () => {
    const schedule = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(42));
    const rounds = new Set(schedule.map((m) => m.roundNumber));
    expect(rounds.size).toBe(3);

    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
      const all = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(new Set(all).size).toBe(4); // no repeated player within a match
    });

    [1, 2, 3].forEach((roundNumber) => {
      const roundMatches = schedule.filter((m) => m.roundNumber === roundNumber);
      expect(roundMatches).toHaveLength(2); // 8 players / 4 per match
      const playersThisRound = roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]);
      expect(new Set(playersThisRound).size).toBe(playersThisRound.length); // nobody double-booked
    });
  });

  it("sits out leftover players when count isn't divisible by 4", () => {
    const sevenPlayers = players.slice(0, 7);
    const schedule = generateRotatingDoublesSchedule(sevenPlayers, 2, 2, mulberry32(7));
    [1, 2].forEach((roundNumber) => {
      const roundMatches = schedule.filter((m) => m.roundNumber === roundNumber);
      expect(roundMatches).toHaveLength(1); // floor(7/4) = 1 match, 3 players sit out
    });
  });

  it("is deterministic given the same seed", () => {
    const a = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(99));
    const b = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(99));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/scheduling/rotatingDoubles.test.ts` — expected: FAIL with "Cannot find module './rotatingDoubles'".

- [ ] **Step 3: Implement `generateRotatingDoublesSchedule`**

```ts
// lib/scheduling/rotatingDoubles.ts
import type { ScheduledMatch } from "./types";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function bestTeamSplit(
  group: string[],
  partnerCounts: Map<string, number>,
  opponentCounts: Map<string, number>,
  rng: () => number
): { side1: string[]; side2: string[] } {
  const [a, b, c, d] = group;
  const options: [string[], string[]][] = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];

  const scored = options.map((opt) => {
    const [s1, s2] = opt;
    const partnerScore =
      (partnerCounts.get(pairKey(s1[0], s1[1])) ?? 0) + (partnerCounts.get(pairKey(s2[0], s2[1])) ?? 0);
    let opponentScore = 0;
    s1.forEach((p1) => s2.forEach((p2) => (opponentScore += opponentCounts.get(pairKey(p1, p2)) ?? 0)));
    return { opt, score: partnerScore * 2 + opponentScore };
  });

  const minScore = Math.min(...scored.map((s) => s.score));
  const bestOptions = scored.filter((s) => s.score === minScore).map((s) => s.opt);
  const chosen = bestOptions[Math.floor(rng() * bestOptions.length)];
  return { side1: chosen[0], side2: chosen[1] };
}

export function generateRotatingDoublesSchedule(
  playerIds: string[],
  numCourts: number,
  numRounds: number,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const schedule: ScheduledMatch[] = [];

  for (let round = 1; round <= numRounds; round++) {
    const shuffled = shuffle(playerIds, rng);
    const groups: string[][] = [];
    for (let i = 0; i + 4 <= shuffled.length; i += 4) {
      groups.push(shuffled.slice(i, i + 4));
    }

    groups.forEach((group, matchIndex) => {
      const { side1, side2 } = bestTeamSplit(group, partnerCounts, opponentCounts, rng);

      const partnerK1 = pairKey(side1[0], side1[1]);
      partnerCounts.set(partnerK1, (partnerCounts.get(partnerK1) ?? 0) + 1);
      const partnerK2 = pairKey(side2[0], side2[1]);
      partnerCounts.set(partnerK2, (partnerCounts.get(partnerK2) ?? 0) + 1);
      side1.forEach((p1) =>
        side2.forEach((p2) => {
          const k = pairKey(p1, p2);
          opponentCounts.set(k, (opponentCounts.get(k) ?? 0) + 1);
        })
      );

      schedule.push({
        roundNumber: round,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: side1,
        side2PlayerIds: side2,
      });
    });
  }

  return schedule;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/scheduling/rotatingDoubles.test.ts` — expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/scheduling/rotatingDoubles.ts lib/scheduling/rotatingDoubles.test.ts
git commit -m "Add rotating-partner doubles schedule generator"
```

---

## Task 6: Player stats pure functions

**Files:**
- Create: `lib/stats.ts`
- Test: `lib/stats.test.ts`

**Interfaces:**
- Produces: `MatchOutcome` type (`{ matchId: string; playedAt: Date; won: boolean }`); `computeWins`, `computeWinPercentage`, `computeCurrentStreak`, `computeTrend` — all take `outcomes: MatchOutcome[]` **sorted ascending by `playedAt`** (caller's responsibility) and read the last element as the most recent match. Task 10 (Player Profile) and Task 14 (Standings) both import all four functions plus the `MatchOutcome` type.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/stats.test.ts
import { describe, it, expect } from "vitest";
import { computeWins, computeWinPercentage, computeCurrentStreak, computeTrend, type MatchOutcome } from "./stats";

function outcome(won: boolean, daysAgo: number): MatchOutcome {
  return { matchId: `m-${daysAgo}`, playedAt: new Date(Date.now() - daysAgo * 86400000), won };
}

describe("computeWins", () => {
  it("counts wins only", () => {
    const outcomes = [outcome(true, 3), outcome(false, 2), outcome(true, 1)];
    expect(computeWins(outcomes)).toBe(2);
  });

  it("returns 0 for no matches", () => {
    expect(computeWins([])).toBe(0);
  });
});

describe("computeWinPercentage", () => {
  it("returns win percentage rounded to 1 decimal", () => {
    const outcomes = [outcome(true, 3), outcome(false, 2), outcome(true, 1)];
    expect(computeWinPercentage(outcomes)).toBeCloseTo(66.7, 1);
  });

  it("returns 0 for no matches", () => {
    expect(computeWinPercentage([])).toBe(0);
  });
});

describe("computeCurrentStreak", () => {
  it("counts consecutive identical results ending at the most recent match", () => {
    // ascending by playedAt: oldest first
    const outcomes = [outcome(true, 5), outcome(false, 4), outcome(true, 3), outcome(true, 2), outcome(true, 1)];
    expect(computeCurrentStreak(outcomes)).toEqual({ count: 3, type: "W" });
  });

  it("counts a losing streak", () => {
    const outcomes = [outcome(true, 3), outcome(false, 2), outcome(false, 1)];
    expect(computeCurrentStreak(outcomes)).toEqual({ count: 2, type: "L" });
  });

  it("returns count 0 and type null for no matches", () => {
    expect(computeCurrentStreak([])).toEqual({ count: 0, type: null });
  });
});

describe("computeTrend", () => {
  it("is 'up' when the most recent match was a win", () => {
    const outcomes = [outcome(false, 2), outcome(true, 1)];
    expect(computeTrend(outcomes)).toBe("up");
  });

  it("is 'down' when the most recent match was a loss", () => {
    const outcomes = [outcome(true, 2), outcome(false, 1)];
    expect(computeTrend(outcomes)).toBe("down");
  });

  it("is 'flat' for no matches", () => {
    expect(computeTrend([])).toBe("flat");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/stats.test.ts` — expected: FAIL with "Cannot find module './stats'".

- [ ] **Step 3: Implement the stats functions**

```ts
// lib/stats.ts
export interface MatchOutcome {
  matchId: string;
  playedAt: Date;
  won: boolean;
}

export function computeWins(outcomes: MatchOutcome[]): number {
  return outcomes.filter((o) => o.won).length;
}

export function computeWinPercentage(outcomes: MatchOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const wins = computeWins(outcomes);
  return Math.round((wins / outcomes.length) * 1000) / 10;
}

export function computeCurrentStreak(outcomes: MatchOutcome[]): { count: number; type: "W" | "L" | null } {
  if (outcomes.length === 0) return { count: 0, type: null };

  const mostRecent = outcomes[outcomes.length - 1];
  const type: "W" | "L" = mostRecent.won ? "W" : "L";
  let count = 0;

  for (let i = outcomes.length - 1; i >= 0; i--) {
    const isWin = outcomes[i].won;
    if ((type === "W" && isWin) || (type === "L" && !isWin)) {
      count++;
    } else {
      break;
    }
  }

  return { count, type };
}

export function computeTrend(outcomes: MatchOutcome[]): "up" | "down" | "flat" {
  if (outcomes.length === 0) return "flat";
  return outcomes[outcomes.length - 1].won ? "up" : "down";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/stats.test.ts` — expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts lib/stats.test.ts
git commit -m "Add player stats pure functions"
```

---

## Task 7: Initials util and Avatar component

**Files:**
- Create: `lib/initials.ts`
- Create: `components/Avatar.tsx`
- Test: `lib/initials.test.ts`
- Test: `components/Avatar.test.tsx`

**Interfaces:**
- Produces: `getInitials(name: string): string`; `<Avatar name={string} size?: "sm" | "md" />` React component. Every later page task (Players, Player Profile, Standings, Dashboard) renders `<Avatar>` wherever the prototypes show a player identifier — never an `<img>`.

- [ ] **Step 1: Write the failing tests for `getInitials`**

```ts
// lib/initials.test.ts
import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("takes the first letter of the first and last name", () => {
    expect(getInitials("Sarah Waters")).toBe("SW");
  });

  it("handles a single-word name by taking its first two letters", () => {
    expect(getInitials("Cher")).toBe("CH");
  });

  it("ignores extra whitespace", () => {
    expect(getInitials("  Bob   Marley  ")).toBe("BM");
  });

  it("handles a three-part name by using first and last only", () => {
    expect(getInitials("Mary Jane Watson")).toBe("MW");
  });

  it("returns an empty string for an empty name", () => {
    expect(getInitials("")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/initials.test.ts` — expected: FAIL with "Cannot find module './initials'".

- [ ] **Step 3: Implement `getInitials`**

```ts
// lib/initials.ts
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/initials.test.ts` — expected: 5 passed.

- [ ] **Step 5: Write the failing test for the Avatar component**

```tsx
// components/Avatar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders the player's initials, not an image", () => {
    render(<Avatar name="Sarah Waters" />);
    expect(screen.getByText("SW")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- components/Avatar.test.tsx` — expected: FAIL with "Cannot find module './Avatar'".

- [ ] **Step 7: Implement the Avatar component**

```tsx
// components/Avatar.tsx
import { getInitials } from "@/lib/initials";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = getInitials(name);
  const sizeClasses = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";

  return (
    <div
      className={`${sizeClasses} rounded-full bg-surface-container-highest text-primary font-headline font-semibold flex items-center justify-center shrink-0`}
      title={name}
    >
      {initials}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- components/Avatar.test.tsx` — expected: 1 passed.

- [ ] **Step 9: Commit**

```bash
git add lib/initials.ts lib/initials.test.ts components/Avatar.tsx components/Avatar.test.tsx
git commit -m "Add initials util and Avatar component"
```

---

## Task 8: Shared UI primitives (Card, Button, Badge, StatCard, Nav)

**Files:**
- Create: `components/Card.tsx`, `components/Button.tsx`, `components/Badge.tsx`, `components/StatCard.tsx`, `components/Nav.tsx`
- Test: `components/Card.test.tsx`, `components/Button.test.tsx`, `components/Badge.test.tsx`, `components/StatCard.test.tsx`, `components/Nav.test.tsx`
- Modify: `app/layout.tsx` (render `<Nav />` above `{children}`)

**Interfaces:**
- Produces: `<Card>`, `<Button variant="primary"|"secondary"|"tertiary" href?>`, `<Badge>`, `<StatCard label value sublabel?>`, `<Nav>` (reads the current route via `usePathname` to highlight the active link — no props). Every page task from Task 9 onward composes pages out of these five components plus `<Avatar>` from Task 7.

- [ ] **Step 1: Write and run the Card test, then implement**

```tsx
// components/Card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

Run: `npm run test -- components/Card.test.tsx` — expected: FAIL ("Cannot find module './Card'").

```tsx
// components/Card.tsx
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest border border-surface-container-high rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}
```

Run: `npm run test -- components/Card.test.tsx` — expected: 1 passed.

- [ ] **Step 2: Write and run the Button test, then implement**

```tsx
// components/Button.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a <button> by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders a link when href is provided", () => {
    render(<Button href="/tournaments/new">Create Tournament</Button>);
    const link = screen.getByRole("link", { name: "Create Tournament" });
    expect(link).toHaveAttribute("href", "/tournaments/new");
  });
});
```

Run: `npm run test -- components/Button.test.tsx` — expected: FAIL ("Cannot find module './Button'").

```tsx
// components/Button.tsx
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary";

const variantClasses: Record<Variant, string> = {
  primary: "bg-secondary text-on-secondary hover:opacity-90",
  secondary: "bg-transparent border border-outline/20 text-on-surface hover:bg-surface-container-low",
  tertiary: "bg-transparent text-on-surface hover:bg-surface-container-low",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
  children: ReactNode;
}

export function Button({ variant = "primary", href, className = "", children, ...props }: ButtonProps) {
  const classes = `px-4 py-2 rounded font-body font-medium text-sm transition-colors ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
```

Run: `npm run test -- components/Button.test.tsx` — expected: 2 passed.

- [ ] **Step 3: Write and run the Badge test, then implement**

```tsx
// components/Badge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its label text", () => {
    render(<Badge>Final</Badge>);
    expect(screen.getByText("Final")).toBeInTheDocument();
  });
});
```

Run: `npm run test -- components/Badge.test.tsx` — expected: FAIL ("Cannot find module './Badge'").

```tsx
// components/Badge.tsx
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-tertiary-container text-on-tertiary-container font-mono text-xs uppercase tracking-wide px-2 py-1 rounded">
      {children}
    </span>
  );
}
```

Run: `npm run test -- components/Badge.test.tsx` — expected: 1 passed.

- [ ] **Step 4: Write and run the StatCard test, then implement**

```tsx
// components/StatCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Active Players" value="1,284" />);
    expect(screen.getByText("Active Players")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });

  it("renders an optional sublabel", () => {
    render(<StatCard label="Active Players" value="1,284" sublabel="+12% from last month" />);
    expect(screen.getByText("+12% from last month")).toBeInTheDocument();
  });

  it("omits the sublabel paragraph when not provided", () => {
    const { container } = render(<StatCard label="Active Players" value="1,284" />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });
});
```

Run: `npm run test -- components/StatCard.test.tsx` — expected: FAIL ("Cannot find module './StatCard'").

```tsx
// components/StatCard.tsx
import { Card } from "./Card";

export function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="font-headline text-3xl font-bold mt-2">{value}</p>
      {sublabel && <p className="font-body text-sm text-on-surface-variant mt-1">{sublabel}</p>}
    </Card>
  );
}
```

Run: `npm run test -- components/StatCard.test.tsx` — expected: 3 passed.

- [ ] **Step 5: Write and run the Nav test, then implement**

```tsx
// components/Nav.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/standings",
}));

describe("Nav", () => {
  it("renders exactly the four required nav links", () => {
    render(<Nav />);
    const expected = ["Dashboard", "Tournaments", "Standings", "Players"];
    expected.forEach((label) => {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("highlights the link matching the current path", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Standings" }).className).toContain("text-secondary");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("text-secondary");
  });
});
```

Run: `npm run test -- components/Nav.test.tsx` — expected: FAIL ("Cannot find module './Nav'").

```tsx
// components/Nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/standings", label: "Standings" },
  { href: "/players", label: "Players" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-surface-container-high">
      <div className="max-w-container-max mx-auto px-gutter h-16 flex items-center justify-between">
        <span className="font-headline text-xl font-bold">PickleLeague</span>
        <nav className="flex gap-6">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-body text-sm ${isActive ? "text-secondary font-semibold" : "text-on-surface-variant"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
```

Run: `npm run test -- components/Nav.test.tsx` — expected: 2 passed.

- [ ] **Step 6: Render Nav in the root layout**

Modify `app/layout.tsx`: import `Nav` from `"@/components/Nav"` and render it as the first child inside `<body>`, before `{children}`:

```tsx
import { Nav } from "@/components/Nav";
// ...
      <body className="bg-surface text-on-surface font-body min-h-screen">
        <Nav />
        {children}
      </body>
```

- [ ] **Step 7: Run the full test suite and verify the dev server still renders**

Run: `npm run test` — expected: all tests across every prior task still pass.

Run: `npm run dev`, visit `http://localhost:3000` — expected: the placeholder Dashboard now shows the Nav bar above it with 4 links; stop the server with Ctrl+C once confirmed.

- [ ] **Step 8: Commit**

```bash
git add components/ app/layout.tsx
git commit -m "Add shared UI primitives and site nav"
```

---

## Task 9: Players data layer, server actions, and Players page

**Files:**
- Create: `lib/data/players.ts`
- Create: `lib/actions/players.ts`
- Create: `components/players/AddPlayerForm.tsx`, `components/players/EditPlayerForm.tsx`, `components/players/PlayerListItem.tsx`
- Create: `app/players/page.tsx`
- Test: `lib/data/players.test.ts`, `components/players/AddPlayerForm.test.tsx`, `components/players/EditPlayerForm.test.tsx`

**Interfaces:**
- Consumes: `db`, `players`, `matches`, `matchParticipants` from `lib/db/schema.ts`/`lib/db/client.ts` (Task 2); `MatchOutcome` type from `lib/stats.ts` (Task 6); `Avatar`, `Card`, `Button` (Tasks 7-8).
- Produces: `PlayerRow` type (`{ id: string; name: string; duprRating: string }`); `getAllPlayers(): Promise<PlayerRow[]>`; `getPlayerById(id: string): Promise<PlayerRow | null>`; `getPlayerMatchOutcomes(playerId: string): Promise<MatchOutcome[]>` (ascending by `playedAt`, `final` matches only) — Task 10 and Task 14 both import all three from `lib/data/players.ts`. `createPlayer(formData: FormData): Promise<PlayerRow>` (returns the newly inserted row so callers can use it immediately without a refetch) and `updatePlayer(id: string, formData: FormData): Promise<void>` server actions from `lib/actions/players.ts` — Task 12's participant picker imports `createPlayer` to add a player inline without leaving the Round Robin Setup page.

- [ ] **Step 1: Write the failing data-layer test**

This runs against the real Neon database (same pattern as Task 2's smoke test) and cleans up after itself.

```ts
// lib/data/players.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAllPlayers, getPlayerById, getPlayerMatchOutcomes } from "./players";

describe("players data layer", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) {
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) {
      await db.delete(players).where(eq(players.id, id));
    }
  });

  it("getAllPlayers and getPlayerById return inserted players", async () => {
    const [p1] = await db.insert(players).values({ name: "__Test Player One__", duprRating: "3.50" }).returning();
    insertedPlayerIds.push(p1.id);

    const all = await getAllPlayers();
    expect(all.some((p) => p.id === p1.id)).toBe(true);

    const fetched = await getPlayerById(p1.id);
    expect(fetched?.name).toBe("__Test Player One__");
  });

  it("getPlayerMatchOutcomes returns only final matches, sorted ascending, with correct win/loss", async () => {
    const [p1] = await db.insert(players).values({ name: "__Test Player Two__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Test Player Three__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Test Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-02-01T00:00:00Z");

    const [match1] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 5,
        status: "final",
        playedAt: newer,
      })
      .returning();
    const [match2] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 2,
        side1Score: 3,
        side2Score: 11,
        status: "final",
        playedAt: older,
      })
      .returning();
    const [scheduledMatch] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 3, status: "scheduled" })
      .returning();
    insertedMatchIds.push(match1.id, match2.id, scheduledMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: match1.id, playerId: p1.id, side: 1 },
      { matchId: match1.id, playerId: p2.id, side: 2 },
      { matchId: match2.id, playerId: p1.id, side: 1 },
      { matchId: match2.id, playerId: p2.id, side: 2 },
      { matchId: scheduledMatch.id, playerId: p1.id, side: 1 },
    ]);

    const outcomes = await getPlayerMatchOutcomes(p1.id);
    expect(outcomes).toHaveLength(2); // scheduled match excluded
    expect(outcomes[0].matchId).toBe(match2.id); // older match first
    expect(outcomes[0].won).toBe(false); // 3-11
    expect(outcomes[1].matchId).toBe(match1.id);
    expect(outcomes[1].won).toBe(true); // 11-5
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/data/players.test.ts` — expected: FAIL with "Cannot find module './players'".

- [ ] **Step 3: Implement the players data layer**

```ts
// lib/data/players.ts
import { db } from "@/lib/db/client";
import { players, matches, matchParticipants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { MatchOutcome } from "@/lib/stats";

export interface PlayerRow {
  id: string;
  name: string;
  duprRating: string;
}

export async function getAllPlayers(): Promise<PlayerRow[]> {
  return db.select({ id: players.id, name: players.name, duprRating: players.duprRating }).from(players);
}

export async function getPlayerById(id: string): Promise<PlayerRow | null> {
  const rows = await db
    .select({ id: players.id, name: players.name, duprRating: players.duprRating })
    .from(players)
    .where(eq(players.id, id));
  return rows[0] ?? null;
}

export async function getPlayerMatchOutcomes(playerId: string): Promise<MatchOutcome[]> {
  const rows = await db
    .select({
      matchId: matches.id,
      playedAt: matches.playedAt,
      side: matchParticipants.side,
      side1Score: matches.side1Score,
      side2Score: matches.side2Score,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .where(and(eq(matchParticipants.playerId, playerId), eq(matches.status, "final")));

  return rows
    .filter((r) => r.playedAt !== null && r.side1Score !== null && r.side2Score !== null)
    .map((r) => {
      const ownScore = r.side === 1 ? r.side1Score! : r.side2Score!;
      const otherScore = r.side === 1 ? r.side2Score! : r.side1Score!;
      return { matchId: r.matchId, playedAt: r.playedAt as Date, won: ownScore > otherScore };
    })
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/data/players.test.ts` — expected: 2 passed.

- [ ] **Step 5: Write the failing tests for the player forms**

```tsx
// components/players/AddPlayerForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddPlayerForm } from "./AddPlayerForm";

describe("AddPlayerForm", () => {
  it("calls onSubmit with the entered name and DUPR rating, then clears the form", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddPlayerForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Sterling" } });
    fireEvent.change(screen.getByLabelText("DUPR Rating"), { target: { value: "4.8" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Player" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Alex Sterling");
    expect(formData.get("duprRating")).toBe("4.8");
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(""));
  });

  it("shows an error message if onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Name and DUPR rating are required"));
    render(<AddPlayerForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Player" }));

    expect(await screen.findByText("Name and DUPR rating are required")).toBeInTheDocument();
  });
});
```

```tsx
// components/players/EditPlayerForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditPlayerForm } from "./EditPlayerForm";

describe("EditPlayerForm", () => {
  const player = { id: "p1", name: "Alex Sterling", duprRating: "4.80" };

  it("pre-fills the current name and rating, and calls onSubmit with edits", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EditPlayerForm player={player} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Alex Sterling");
    expect(screen.getByLabelText("DUPR Rating")).toHaveValue(4.8);

    fireEvent.change(screen.getByLabelText("DUPR Rating"), { target: { value: "5.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("duprRating")).toBe("5.0");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<EditPlayerForm player={player} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm run test -- components/players/AddPlayerForm.test.tsx components/players/EditPlayerForm.test.tsx` — expected: FAIL with "Cannot find module".

- [ ] **Step 7: Implement the forms**

```tsx
// components/players/AddPlayerForm.tsx
"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function AddPlayerForm({ onSubmit }: { onSubmit: (formData: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col text-sm gap-1">
        Name
        <input name="name" required className="border border-outline-variant rounded px-3 py-2" />
      </label>
      <label className="flex flex-col text-sm gap-1">
        DUPR Rating
        <input
          name="duprRating"
          type="number"
          step="0.1"
          min="1"
          max="8"
          required
          className="border border-outline-variant rounded px-3 py-2 w-28"
        />
      </label>
      <Button type="submit">Add Player</Button>
      {error && <p className="text-error text-sm w-full">{error}</p>}
    </form>
  );
}
```

```tsx
// components/players/EditPlayerForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import type { PlayerRow } from "@/lib/data/players";

export function EditPlayerForm({
  player,
  onSubmit,
  onCancel,
}: {
  player: PlayerRow;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col text-sm gap-1">
        Name
        <input name="name" defaultValue={player.name} required className="border border-outline-variant rounded px-3 py-2" />
      </label>
      <label className="flex flex-col text-sm gap-1">
        DUPR Rating
        <input
          name="duprRating"
          type="number"
          step="0.1"
          min="1"
          max="8"
          defaultValue={player.duprRating}
          required
          className="border border-outline-variant rounded px-3 py-2 w-28"
        />
      </label>
      <Button type="submit">Save</Button>
      <Button type="button" variant="tertiary" onClick={onCancel}>
        Cancel
      </Button>
      {error && <p className="text-error text-sm w-full">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test -- components/players/AddPlayerForm.test.tsx components/players/EditPlayerForm.test.tsx` — expected: 4 passed.

- [ ] **Step 9: Implement the server actions**

```ts
// lib/actions/players.ts
"use server";

import { db } from "@/lib/db/client";
import { players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PlayerRow } from "@/lib/data/players";

export async function createPlayer(formData: FormData): Promise<PlayerRow> {
  const name = String(formData.get("name") ?? "").trim();
  const duprRating = String(formData.get("duprRating") ?? "").trim();
  if (!name || !duprRating) {
    throw new Error("Name and DUPR rating are required");
  }
  const [inserted] = await db
    .insert(players)
    .values({ name, duprRating })
    .returning({ id: players.id, name: players.name, duprRating: players.duprRating });
  revalidatePath("/players");
  return inserted;
}

export async function updatePlayer(id: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const duprRating = String(formData.get("duprRating") ?? "").trim();
  if (!name || !duprRating) {
    throw new Error("Name and DUPR rating are required");
  }
  await db.update(players).set({ name, duprRating }).where(eq(players.id, id));
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
}
```

- [ ] **Step 10: Wire up `PlayerListItem` and the Players page**

```tsx
// components/players/PlayerListItem.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EditPlayerForm } from "./EditPlayerForm";
import type { PlayerRow } from "@/lib/data/players";

export function PlayerListItem({
  player,
  onUpdate,
}: {
  player: PlayerRow;
  onUpdate: (formData: FormData) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="p-4">
        <EditPlayerForm
          player={player}
          onSubmit={async (formData) => {
            await onUpdate(formData);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4">
      <Link href={`/players/${player.id}`} className="flex items-center gap-3">
        <Avatar name={player.name} size="sm" />
        <span className="font-body font-medium">{player.name}</span>
        <span className="font-mono text-xs text-on-surface-variant">{player.duprRating} DUPR</span>
      </Link>
      <Button variant="tertiary" onClick={() => setIsEditing(true)}>
        Edit
      </Button>
    </div>
  );
}
```

```tsx
// app/players/page.tsx
import { getAllPlayers } from "@/lib/data/players";
import { createPlayer, updatePlayer } from "@/lib/actions/players";
import { AddPlayerForm } from "@/components/players/AddPlayerForm";
import { PlayerListItem } from "@/components/players/PlayerListItem";
import { Card } from "@/components/Card";

export default async function PlayersPage() {
  const allPlayers = await getAllPlayers();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <h1 className="font-headline text-3xl font-bold">Players</h1>

      <Card>
        <h2 className="font-headline text-lg font-semibold mb-4">Add Player</h2>
        <AddPlayerForm onSubmit={createPlayer} />
      </Card>

      <Card className="p-0 divide-y divide-surface-container-high">
        {allPlayers.map((player) => (
          <PlayerListItem key={player.id} player={player} onUpdate={updatePlayer.bind(null, player.id)} />
        ))}
      </Card>
    </main>
  );
}
```

- [ ] **Step 11: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/players` — add a player via the form, confirm it appears in the list below without a page reload; click "Edit" on a player, change the DUPR rating, click "Save", confirm the new value displays. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 12: Commit**

```bash
git add lib/data/players.ts lib/data/players.test.ts lib/actions/players.ts components/players app/players/page.tsx
git commit -m "Add players data layer, server actions, and Players page"
```

---

## Task 10: Player Profile page

**Files:**
- Create: `lib/standings.ts`
- Create: `lib/data/standings.ts`
- Create: `lib/data/matchHistory.ts`
- Create: `components/players/MatchSparkline.tsx`
- Create: `app/players/[id]/page.tsx`
- Test: `lib/standings.test.ts`, `lib/data/standings.test.ts`, `lib/data/matchHistory.test.ts`, `components/players/MatchSparkline.test.tsx`

**Interfaces:**
- Consumes: `getAllPlayers`, `getPlayerById`, `getPlayerMatchOutcomes` (Task 9); `computeWins`, `computeWinPercentage`, `computeCurrentStreak` (Task 6); `Avatar`, `Card`, `StatCard` (Tasks 7-8).
- Produces: `StandingRow` type (`{ id, name, duprRating, wins, matchesPlayed, winPercentage, trend }`); `rankPlayerByWins(standings: StandingRow[], playerId: string): { rank: number; totalPlayers: number }` from `lib/standings.ts`; `getStandings(): Promise<StandingRow[]>` from `lib/data/standings.ts`; `MatchHistoryEntry` type and `getPlayerMatchHistory(playerId: string): Promise<MatchHistoryEntry[]>` (most-recent-first) from `lib/data/matchHistory.ts`. Task 14 (Standings page) imports `StandingRow` and `getStandings` from these same two files.

- [ ] **Step 1: Write the failing test for `rankPlayerByWins`**

```ts
// lib/standings.test.ts
import { describe, it, expect } from "vitest";
import { rankPlayerByWins, type StandingRow } from "./standings";

function row(id: string, wins: number): StandingRow {
  return { id, name: id, duprRating: "4.00", wins, matchesPlayed: wins + 1, winPercentage: 50, trend: "flat" };
}

describe("rankPlayerByWins", () => {
  it("ranks players by wins descending, 1-indexed", () => {
    const standings = [row("a", 5), row("b", 10), row("c", 2)];
    expect(rankPlayerByWins(standings, "b")).toEqual({ rank: 1, totalPlayers: 3 });
    expect(rankPlayerByWins(standings, "a")).toEqual({ rank: 2, totalPlayers: 3 });
    expect(rankPlayerByWins(standings, "c")).toEqual({ rank: 3, totalPlayers: 3 });
  });

  it("returns rank 0 if the player isn't found", () => {
    const standings = [row("a", 5)];
    expect(rankPlayerByWins(standings, "missing")).toEqual({ rank: 0, totalPlayers: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/standings.test.ts` — expected: FAIL with "Cannot find module './standings'".

- [ ] **Step 3: Implement `rankPlayerByWins`**

```ts
// lib/standings.ts
export interface StandingRow {
  id: string;
  name: string;
  duprRating: string;
  wins: number;
  matchesPlayed: number;
  winPercentage: number;
  trend: "up" | "down" | "flat";
}

export function rankPlayerByWins(
  standings: StandingRow[],
  playerId: string
): { rank: number; totalPlayers: number } {
  const sorted = [...standings].sort((a, b) => b.wins - a.wins);
  const index = sorted.findIndex((s) => s.id === playerId);
  return { rank: index === -1 ? 0 : index + 1, totalPlayers: sorted.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/standings.test.ts` — expected: 2 passed.

- [ ] **Step 5: Write the failing data-layer test for `getStandings`**

```ts
// lib/data/standings.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStandings } from "./standings";

describe("getStandings", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("computes wins, matches played, and win percentage per player", async () => {
    const [p1] = await db.insert(players).values({ name: "__Standings Winner__", duprRating: "4.50" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Loser__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Standings Test Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const [match] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    insertedMatchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 2 },
    ]);

    const standings = await getStandings();
    const winnerRow = standings.find((s) => s.id === p1.id);
    const loserRow = standings.find((s) => s.id === p2.id);

    expect(winnerRow).toMatchObject({ wins: 1, matchesPlayed: 1, winPercentage: 100 });
    expect(loserRow).toMatchObject({ wins: 0, matchesPlayed: 1, winPercentage: 0 });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- lib/data/standings.test.ts` — expected: FAIL with "Cannot find module './standings'".

- [ ] **Step 7: Implement `getStandings`**

```ts
// lib/data/standings.ts
import { getAllPlayers, getPlayerMatchOutcomes } from "./players";
import { computeWins, computeWinPercentage, computeTrend } from "@/lib/stats";
import type { StandingRow } from "@/lib/standings";

export async function getStandings(): Promise<StandingRow[]> {
  const allPlayers = await getAllPlayers();

  const rows: StandingRow[] = [];
  for (const player of allPlayers) {
    const outcomes = await getPlayerMatchOutcomes(player.id);
    rows.push({
      id: player.id,
      name: player.name,
      duprRating: player.duprRating,
      wins: computeWins(outcomes),
      matchesPlayed: outcomes.length,
      winPercentage: computeWinPercentage(outcomes),
      trend: computeTrend(outcomes),
    });
  }
  return rows;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- lib/data/standings.test.ts` — expected: 1 passed.

- [ ] **Step 9: Write the failing test for `MatchSparkline`**

```tsx
// components/players/MatchSparkline.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchSparkline } from "./MatchSparkline";

describe("MatchSparkline", () => {
  it("shows a placeholder message when there are no matches", () => {
    render(<MatchSparkline results={[]} />);
    expect(screen.getByText("No matches played yet")).toBeInTheDocument();
  });

  it("renders at most the last 15 results", () => {
    const results = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
    const { container } = render(<MatchSparkline results={results} />);
    expect(container.querySelectorAll("span[title]")).toHaveLength(15);
  });

  it("labels wins and losses distinctly", () => {
    render(<MatchSparkline results={[true, false]} />);
    expect(screen.getByTitle("Win")).toBeInTheDocument();
    expect(screen.getByTitle("Loss")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test -- components/players/MatchSparkline.test.tsx` — expected: FAIL with "Cannot find module './MatchSparkline'".

- [ ] **Step 11: Implement `MatchSparkline`**

```tsx
// components/players/MatchSparkline.tsx
export function MatchSparkline({ results }: { results: boolean[] }) {
  const recent = results.slice(-15);

  if (recent.length === 0) {
    return <p className="text-sm text-on-surface-variant">No matches played yet</p>;
  }

  return (
    <div className="flex gap-1">
      {recent.map((won, i) => (
        <span key={i} title={won ? "Win" : "Loss"} className={`w-2 h-6 rounded-sm ${won ? "bg-secondary" : "bg-error"}`} />
      ))}
    </div>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm run test -- components/players/MatchSparkline.test.tsx` — expected: 3 passed.

- [ ] **Step 13: Write the failing data-layer test for `getPlayerMatchHistory`**

```ts
// lib/data/matchHistory.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlayerMatchHistory } from "./matchHistory";

describe("getPlayerMatchHistory", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("includes partner and opponent names for a doubles match", async () => {
    const names = ["__History P1__", "__History P2__", "__History P3__", "__History P4__"];
    const inserted = [];
    for (const name of names) {
      const [p] = await db.insert(players).values({ name, duprRating: "4.00" }).returning();
      inserted.push(p);
    }
    insertedPlayerIds.push(...inserted.map((p) => p.id));
    const [p1, p2, p3, p4] = inserted;

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__History Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "doubles", teamMode: "fixed" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const [match] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 7,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    insertedMatchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 1 },
      { matchId: match.id, playerId: p3.id, side: 2 },
      { matchId: match.id, playerId: p4.id, side: 2 },
    ]);

    const history = await getPlayerMatchHistory(p1.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      tournamentName: "__History Tournament__",
      ownScore: 11,
      opponentScore: 7,
      won: true,
      partnerNames: ["__History P2__"],
    });
    expect(new Set(history[0].opponentNames)).toEqual(new Set(["__History P3__", "__History P4__"]));
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npm run test -- lib/data/matchHistory.test.ts` — expected: FAIL with "Cannot find module './matchHistory'".

- [ ] **Step 15: Implement `getPlayerMatchHistory`**

```ts
// lib/data/matchHistory.ts
import { db } from "@/lib/db/client";
import { matches, matchParticipants, players, tournaments } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface MatchHistoryEntry {
  matchId: string;
  tournamentName: string;
  playedAt: Date;
  ownScore: number;
  opponentScore: number;
  won: boolean;
  partnerNames: string[];
  opponentNames: string[];
}

export async function getPlayerMatchHistory(playerId: string): Promise<MatchHistoryEntry[]> {
  const ownRows = await db
    .select({
      matchId: matches.id,
      tournamentName: tournaments.name,
      playedAt: matches.playedAt,
      side: matchParticipants.side,
      side1Score: matches.side1Score,
      side2Score: matches.side2Score,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(and(eq(matchParticipants.playerId, playerId), eq(matches.status, "final")));

  const finalRows = ownRows.filter((r) => r.playedAt !== null && r.side1Score !== null && r.side2Score !== null);
  if (finalRows.length === 0) return [];

  const matchIds = finalRows.map((r) => r.matchId);
  const allParticipants = await db
    .select({
      matchId: matchParticipants.matchId,
      playerId: matchParticipants.playerId,
      side: matchParticipants.side,
      name: players.name,
    })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { playerId: string; side: number; name: string }[]>();
  for (const p of allParticipants) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  return finalRows
    .map((r) => {
      const ownScore = r.side === 1 ? r.side1Score! : r.side2Score!;
      const opponentScore = r.side === 1 ? r.side2Score! : r.side1Score!;
      const participants = participantsByMatch.get(r.matchId) ?? [];
      const partnerNames = participants.filter((p) => p.side === r.side && p.playerId !== playerId).map((p) => p.name);
      const opponentNames = participants.filter((p) => p.side !== r.side).map((p) => p.name);

      return {
        matchId: r.matchId,
        tournamentName: r.tournamentName,
        playedAt: r.playedAt as Date,
        ownScore,
        opponentScore,
        won: ownScore > opponentScore,
        partnerNames,
        opponentNames,
      };
    })
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `npm run test -- lib/data/matchHistory.test.ts` — expected: 1 passed.

- [ ] **Step 17: Wire up the Player Profile page**

```tsx
// app/players/[id]/page.tsx
import { notFound } from "next/navigation";
import { getPlayerById, getPlayerMatchOutcomes } from "@/lib/data/players";
import { getPlayerMatchHistory } from "@/lib/data/matchHistory";
import { getStandings } from "@/lib/data/standings";
import { rankPlayerByWins } from "@/lib/standings";
import { computeWins, computeWinPercentage, computeCurrentStreak } from "@/lib/stats";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { MatchSparkline } from "@/components/players/MatchSparkline";

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const player = await getPlayerById(params.id);
  if (!player) notFound();

  const [outcomes, history, standings] = await Promise.all([
    getPlayerMatchOutcomes(player.id),
    getPlayerMatchHistory(player.id),
    getStandings(),
  ]);

  const { rank, totalPlayers } = rankPlayerByWins(standings, player.id);
  const wins = computeWins(outcomes);
  const losses = outcomes.length - wins;
  const winPercentage = computeWinPercentage(outcomes);
  const streak = computeCurrentStreak(outcomes);

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Avatar name={player.name} />
        <div>
          <h1 className="font-headline text-3xl font-bold">{player.name}</h1>
          <p className="font-mono text-sm text-on-surface-variant">{player.duprRating} DUPR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Global Rank" value={`#${rank}`} sublabel={`of ${totalPlayers} players`} />
        <StatCard label="Win/Loss Record" value={`${wins}-${losses}`} />
        <StatCard label="Win %" value={`${winPercentage}%`} />
        <StatCard label="Current Streak" value={streak.type ? `${streak.count}${streak.type}` : "—"} />
      </div>

      <Card>
        <h2 className="font-headline text-lg font-semibold mb-4">Recent Form</h2>
        <MatchSparkline results={outcomes.map((o) => o.won)} />
      </Card>

      <Card className="p-0 divide-y divide-surface-container-high">
        <h2 className="font-headline text-lg font-semibold p-6 pb-0">Match History</h2>
        {history.length === 0 && <p className="p-6 text-on-surface-variant">No matches played yet.</p>}
        {history.map((entry) => (
          <div key={entry.matchId} className="flex items-center justify-between p-6">
            <div>
              <p className="font-body font-medium">
                vs. {entry.opponentNames.join(" & ")}
                {entry.partnerNames.length > 0 && (
                  <span className="text-on-surface-variant"> (with {entry.partnerNames.join(" & ")})</span>
                )}
              </p>
              <p className="font-mono text-xs text-on-surface-variant">{entry.tournamentName}</p>
            </div>
            <p className={`font-headline font-semibold ${entry.won ? "text-secondary" : "text-error"}`}>
              {entry.ownScore}-{entry.opponentScore}
            </p>
          </div>
        ))}
      </Card>
    </main>
  );
}
```

- [ ] **Step 18: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/players`, click into a player you added earlier — expected: profile page renders with rank, record, win %, streak, sparkline ("No matches played yet" until Task 12/13 produce real matches), and match history. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 19: Commit**

```bash
git add lib/standings.ts lib/standings.test.ts lib/data/standings.ts lib/data/standings.test.ts lib/data/matchHistory.ts lib/data/matchHistory.test.ts components/players/MatchSparkline.tsx components/players/MatchSparkline.test.tsx "app/players/[id]/page.tsx"
git commit -m "Add Player Profile page with rank, stats, sparkline, and match history"
```

---

## Task 11: Tournaments list page

**Files:**
- Create: `lib/data/tournaments.ts`
- Create: `app/tournaments/page.tsx`
- Test: `lib/data/tournaments.test.ts`

**Interfaces:**
- Produces: `TournamentSummary` type (`{ id, name, status, matchFormat, participantCount, createdAt }`); `getAllTournaments(): Promise<TournamentSummary[]>` (newest first). Task 12's Round Robin Setup links from here; Task 13's Tournament Detail is the link target for each row.

- [ ] **Step 1: Write the failing data-layer test**

```ts
// lib/data/tournaments.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, tournamentParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAllTournaments } from "./tournaments";

describe("getAllTournaments", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedTournamentIds) {
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, id));
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("returns participant counts and orders newest first", async () => {
    const [p1] = await db.insert(players).values({ name: "__Tournaments P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Tournaments P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [older] = await db
      .insert(tournaments)
      .values({
        name: "__Older Tournament__",
        numCourts: 2,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newer] = await db
      .insert(tournaments)
      .values({
        name: "__Newer Tournament__",
        numCourts: 2,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      })
      .returning();
    insertedTournamentIds.push(older.id, newer.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: newer.id, playerId: p1.id },
      { tournamentId: newer.id, playerId: p2.id },
    ]);

    const all = await getAllTournaments();
    const newerRow = all.find((t) => t.id === newer.id);
    const olderRow = all.find((t) => t.id === older.id);

    expect(newerRow?.participantCount).toBe(2);
    expect(olderRow?.participantCount).toBe(0);
    expect(all.findIndex((t) => t.id === newer.id)).toBeLessThan(all.findIndex((t) => t.id === older.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/data/tournaments.test.ts` — expected: FAIL with "Cannot find module './tournaments'".

- [ ] **Step 3: Implement `getAllTournaments`**

```ts
// lib/data/tournaments.ts
import { db } from "@/lib/db/client";
import { tournaments, tournamentParticipants } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export interface TournamentSummary {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  participantCount: number;
  createdAt: Date;
}

export async function getAllTournaments(): Promise<TournamentSummary[]> {
  return db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      matchFormat: tournaments.matchFormat,
      createdAt: tournaments.createdAt,
      participantCount: sql<number>`count(${tournamentParticipants.playerId})::int`,
    })
    .from(tournaments)
    .leftJoin(tournamentParticipants, eq(tournamentParticipants.tournamentId, tournaments.id))
    .groupBy(tournaments.id)
    .orderBy(desc(tournaments.createdAt));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/data/tournaments.test.ts` — expected: 1 passed.

- [ ] **Step 5: Wire up the Tournaments list page**

```tsx
// app/tournaments/page.tsx
import Link from "next/link";
import { getAllTournaments } from "@/lib/data/tournaments";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

export default async function TournamentsPage() {
  const allTournaments = await getAllTournaments();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Tournaments</h1>
        <Button href="/tournaments/new">Create Tournament</Button>
      </div>

      <Card className="p-0 divide-y divide-surface-container-high">
        {allTournaments.length === 0 && <p className="p-6 text-on-surface-variant">No tournaments yet.</p>}
        {allTournaments.map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.id}`}
            className="flex items-center justify-between p-4 hover:bg-surface-container-low"
          >
            <div>
              <p className="font-body font-medium">{t.name}</p>
              <p className="font-mono text-xs text-on-surface-variant uppercase">
                {t.matchFormat} &middot; {t.participantCount} participants
              </p>
            </div>
            <Badge>{t.status.replace("_", " ")}</Badge>
          </Link>
        ))}
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/tournaments` — expected: empty state message (no tournaments created yet) and a working "Create Tournament" button (will 404 until Task 12 adds the route — that's expected at this point). Stop the server with Ctrl+C once confirmed.

- [ ] **Step 7: Commit**

```bash
git add lib/data/tournaments.ts lib/data/tournaments.test.ts app/tournaments/page.tsx
git commit -m "Add Tournaments list page"
```

---

## Task 12: Round Robin Setup page and Generate Bracket action

**Files:**
- Create: `lib/scheduling/preview.ts`
- Create: `lib/actions/tournaments.ts`
- Create: `components/tournaments/ParticipantPicker.tsx`
- Create: `components/tournaments/RoundRobinSetupForm.tsx`
- Create: `app/tournaments/new/page.tsx`
- Test: `lib/scheduling/preview.test.ts`, `lib/actions/tournaments.test.ts`, `components/tournaments/RoundRobinSetupForm.test.tsx`

**Interfaces:**
- Consumes: `generateSinglesSchedule` (Task 4), `generateFixedDoublesSchedule` (Task 4), `generateRotatingDoublesSchedule` (Task 5), `ScheduledMatch` type (Task 4); `db`, `tournaments`, `tournamentParticipants`, `matches`, `matchParticipants` (Task 2); `PlayerRow`, `getAllPlayers`, `createPlayer` (Task 9); `AddPlayerForm` (Task 9); `Card`, `Button` (Task 8).
- Produces: `computeSinglesPreview`, `computeFixedDoublesPreview`, `computeRotatingDoublesPreview` (each `(participantOrTeamCount, numCourts, matchDurationMinutes[, numRounds]) => { totalMatches: number; estimatedMinutes: number }`) from `lib/scheduling/preview.ts`; `generateBracket(formData: FormData): Promise<string>` (returns the new tournament's id) from `lib/actions/tournaments.ts`. Task 13 (Tournament Detail) is the page these redirect to.

- [ ] **Step 1: Write the failing tests for the preview calculations**

```ts
// lib/scheduling/preview.test.ts
import { describe, it, expect } from "vitest";
import { computeSinglesPreview, computeFixedDoublesPreview, computeRotatingDoublesPreview } from "./preview";

describe("computeSinglesPreview", () => {
  it("computes total matches and estimated duration for 4 participants on 2 courts", () => {
    const result = computeSinglesPreview(4, 2, 30);
    expect(result.totalMatches).toBe(6); // C(4,2)
    expect(result.estimatedMinutes).toBe(90); // ceil(6/2) rounds * 30 min = 3 * 30
  });

  it("returns zero matches for fewer than 2 participants", () => {
    expect(computeSinglesPreview(1, 2, 30)).toEqual({ totalMatches: 0, estimatedMinutes: 0 });
  });
});

describe("computeFixedDoublesPreview", () => {
  it("computes total matches from team count", () => {
    const result = computeFixedDoublesPreview(4, 2, 30); // 4 teams
    expect(result.totalMatches).toBe(6); // C(4,2)
    expect(result.estimatedMinutes).toBe(90);
  });
});

describe("computeRotatingDoublesPreview", () => {
  it("computes total matches from rounds and group size", () => {
    const result = computeRotatingDoublesPreview(8, 2, 30, 5); // 8 players -> 2 matches/round
    expect(result.totalMatches).toBe(10); // 2 matches/round * 5 rounds
    expect(result.estimatedMinutes).toBe(150); // ceil(10/2) * 30
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/scheduling/preview.test.ts` — expected: FAIL with "Cannot find module './preview'".

- [ ] **Step 3: Implement the preview calculations**

```ts
// lib/scheduling/preview.ts
function estimateMinutes(totalMatches: number, numCourts: number, matchDurationMinutes: number): number {
  if (totalMatches === 0) return 0;
  const roundsNeeded = Math.ceil(totalMatches / numCourts);
  return roundsNeeded * matchDurationMinutes;
}

export function computeSinglesPreview(participantCount: number, numCourts: number, matchDurationMinutes: number) {
  const totalMatches = participantCount < 2 ? 0 : (participantCount * (participantCount - 1)) / 2;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}

export function computeFixedDoublesPreview(teamCount: number, numCourts: number, matchDurationMinutes: number) {
  const totalMatches = teamCount < 2 ? 0 : (teamCount * (teamCount - 1)) / 2;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}

export function computeRotatingDoublesPreview(
  participantCount: number,
  numCourts: number,
  matchDurationMinutes: number,
  numRounds: number
) {
  const matchesPerRound = Math.floor(participantCount / 4);
  const totalMatches = matchesPerRound * numRounds;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/scheduling/preview.test.ts` — expected: 4 passed.

- [ ] **Step 5: Write the failing tests for `generateBracket`**

```ts
// lib/actions/tournaments.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, tournamentParticipants, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateBracket } from "./tournaments";

describe("generateBracket", () => {
  const insertedPlayerIds: string[] = [];
  const createdTournamentIds: string[] = [];

  afterAll(async () => {
    for (const tournamentId of createdTournamentIds) {
      const matchRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId));
      for (const m of matchRows) {
        await db.delete(matchParticipants).where(eq(matchParticipants.matchId, m.id));
      }
      await db.delete(matches).where(eq(matches.tournamentId, tournamentId));
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  async function insertTestPlayers(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const [p] = await db.insert(players).values({ name: `__Bracket P${i}__`, duprRating: "4.00" }).returning();
      ids.push(p.id);
    }
    insertedPlayerIds.push(...ids);
    return ids;
  }

  it("creates a singles tournament with a full round-robin schedule", async () => {
    const ids = await insertTestPlayers(4);

    const formData = new FormData();
    formData.set("name", "__Bracket Singles Tournament__");
    formData.set("numCourts", "2");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "singles");
    ids.forEach((id) => formData.append("participantIds", id));

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    const [tournamentRow] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    expect(tournamentRow.status).toBe("scheduled");
    expect(tournamentRow.matchFormat).toBe("singles");

    const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(matchRows).toHaveLength(6); // C(4,2)

    const participantRows = await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    expect(participantRows).toHaveLength(4);
  });

  it("creates a fixed-team doubles tournament from submitted team pairs", async () => {
    const ids = await insertTestPlayers(4); // 2 teams of 2

    const formData = new FormData();
    formData.set("name", "__Bracket Doubles Tournament__");
    formData.set("numCourts", "1");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "doubles");
    formData.set("teamMode", "fixed");
    ids.forEach((id) => formData.append("participantIds", id));
    formData.append("fixedTeams", `${ids[0]},${ids[1]}`);
    formData.append("fixedTeams", `${ids[2]},${ids[3]}`);

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(matchRows).toHaveLength(1); // C(2,2) team pairings = 1 match

    const participantRows = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchRows[0].id));
    expect(participantRows).toHaveLength(4); // 2 players per side
  });

  it("rejects fewer than 2 participants", async () => {
    const formData = new FormData();
    formData.set("name", "__Invalid Tournament__");
    formData.set("numCourts", "1");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "singles");
    formData.append("participantIds", "only-one-id");

    await expect(generateBracket(formData)).rejects.toThrow("Select at least 2 participants");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm run test -- lib/actions/tournaments.test.ts` — expected: FAIL with "Cannot find module './tournaments'".

- [ ] **Step 7: Implement `generateBracket`**

```ts
// lib/actions/tournaments.ts
"use server";

import { db } from "@/lib/db/client";
import { tournaments, tournamentParticipants, matches, matchParticipants } from "@/lib/db/schema";
import { generateSinglesSchedule } from "@/lib/scheduling/singles";
import { generateFixedDoublesSchedule } from "@/lib/scheduling/fixedDoubles";
import { generateRotatingDoublesSchedule } from "@/lib/scheduling/rotatingDoubles";
import type { ScheduledMatch } from "@/lib/scheduling/types";

export async function generateBracket(formData: FormData): Promise<string> {
  const name = String(formData.get("name") ?? "").trim();
  const numCourts = Number(formData.get("numCourts"));
  const matchDurationMinutes = Number(formData.get("matchDurationMinutes"));
  const matchFormat = String(formData.get("matchFormat"));
  const participantIds = formData.getAll("participantIds").map(String);

  if (!name) throw new Error("Tournament name is required");
  if (!Number.isInteger(numCourts) || numCourts < 1) throw new Error("Number of courts must be at least 1");
  if (!Number.isInteger(matchDurationMinutes) || matchDurationMinutes < 1) {
    throw new Error("Match duration must be at least 1 minute");
  }
  if (matchFormat !== "singles" && matchFormat !== "doubles") throw new Error("Invalid match format");
  if (participantIds.length < 2) throw new Error("Select at least 2 participants");

  let schedule: ScheduledMatch[];
  let teamMode: "fixed" | "rotating" | null = null;
  let numRounds: number | null = null;

  if (matchFormat === "singles") {
    schedule = generateSinglesSchedule(participantIds, numCourts);
  } else {
    teamMode = String(formData.get("teamMode")) as "fixed" | "rotating";
    if (teamMode !== "fixed" && teamMode !== "rotating") throw new Error("Invalid team mode");

    if (teamMode === "fixed") {
      const teamStrings = formData.getAll("fixedTeams").map(String);
      if (teamStrings.length === 0) throw new Error("At least one team is required");
      const teams: [string, string][] = teamStrings.map((t) => {
        const [a, b] = t.split(",");
        return [a, b];
      });
      schedule = generateFixedDoublesSchedule(teams, numCourts);
    } else {
      numRounds = Number(formData.get("numRounds"));
      if (!Number.isInteger(numRounds) || numRounds < 1) throw new Error("Number of rounds must be at least 1");
      schedule = generateRotatingDoublesSchedule(participantIds, numCourts, numRounds);
    }
  }

  if (schedule.length === 0) throw new Error("Not enough participants to generate a schedule");

  const [tournament] = await db
    .insert(tournaments)
    .values({ name, numCourts, matchDurationMinutes, matchFormat, teamMode, numRounds, status: "scheduled" })
    .returning();

  await db
    .insert(tournamentParticipants)
    .values(participantIds.map((playerId) => ({ tournamentId: tournament.id, playerId })));

  for (const scheduledMatch of schedule) {
    const [insertedMatch] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: scheduledMatch.courtNumber,
        roundNumber: scheduledMatch.roundNumber,
        status: "scheduled",
      })
      .returning();

    await db.insert(matchParticipants).values([
      ...scheduledMatch.side1PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 1 })),
      ...scheduledMatch.side2PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 2 })),
    ]);
  }

  return tournament.id;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test -- lib/actions/tournaments.test.ts` — expected: 3 passed.

- [ ] **Step 9: Write the failing test for the setup form's live preview and participant selection**

```tsx
// components/tournaments/RoundRobinSetupForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoundRobinSetupForm } from "./RoundRobinSetupForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const initialPlayers = [
  { id: "p1", name: "Alex Sterling", duprRating: "4.80" },
  { id: "p2", name: "Ben Rivera", duprRating: "4.20" },
  { id: "p3", name: "Chris Jung", duprRating: "3.80" },
  { id: "p4", name: "Dana Kim", duprRating: "4.00" },
];

describe("RoundRobinSetupForm", () => {
  it("updates the singles match preview as participants are selected", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    expect(screen.getByText(/0 matches/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));

    expect(screen.getByText(/6 matches/i)).toBeInTheDocument(); // C(4,2)
  });

  it("pairs selected participants into teams in selection order for fixed-team doubles", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));

    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Fixed Teams"));

    expect(screen.getByText("Alex Sterling & Ben Rivera")).toBeInTheDocument();
    expect(screen.getByText("Chris Jung & Dana Kim")).toBeInTheDocument();
    expect(screen.getByText(/1 match/i)).toBeInTheDocument(); // C(2,2) teams = 1 match
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `npm run test -- components/tournaments/RoundRobinSetupForm.test.tsx` — expected: FAIL with "Cannot find module './RoundRobinSetupForm'".

- [ ] **Step 11: Implement `ParticipantPicker`**

```tsx
// components/tournaments/ParticipantPicker.tsx
"use client";

import { useState } from "react";
import { AddPlayerForm } from "@/components/players/AddPlayerForm";
import type { PlayerRow } from "@/lib/data/players";

export function ParticipantPicker({
  availablePlayers,
  selectedIds,
  onToggle,
  onPlayerAdded,
  onCreatePlayer,
}: {
  availablePlayers: PlayerRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onPlayerAdded: (player: PlayerRow) => void;
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
}) {
  const [filter, setFilter] = useState("");
  const filtered = availablePlayers.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  async function handleCreate(formData: FormData) {
    const player = await onCreatePlayer(formData);
    onPlayerAdded(player);
    onToggle(player.id);
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="Filter by name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border border-outline-variant rounded px-3 py-2 w-full"
      />
      <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {filtered.map((player) => (
          <label key={player.id} className="flex items-center gap-2 border border-outline-variant rounded px-3 py-2">
            <input
              type="checkbox"
              checked={selectedIds.includes(player.id)}
              onChange={() => onToggle(player.id)}
              aria-label={player.name}
            />
            <span>
              {player.name} <span className="font-mono text-xs text-on-surface-variant">{player.duprRating}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <h3 className="font-headline text-sm font-semibold mb-2">Add a new player</h3>
        <AddPlayerForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Implement `RoundRobinSetupForm`**

```tsx
// components/tournaments/RoundRobinSetupForm.tsx
"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ParticipantPicker } from "./ParticipantPicker";
import {
  computeSinglesPreview,
  computeFixedDoublesPreview,
  computeRotatingDoublesPreview,
} from "@/lib/scheduling/preview";
import type { PlayerRow } from "@/lib/data/players";

type MatchFormat = "singles" | "doubles";
type TeamMode = "fixed" | "rotating";

export function RoundRobinSetupForm({
  initialPlayers,
  onSubmit,
  onCreatePlayer,
}: {
  initialPlayers: PlayerRow[];
  onSubmit: (formData: FormData) => Promise<string>;
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(30);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("singles");
  const [teamMode, setTeamMode] = useState<TeamMode>("fixed");
  const [numRounds, setNumRounds] = useState(4);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerRow[]>(initialPlayers);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const playersById = useMemo(() => new Map(availablePlayers.map((p) => [p.id, p])), [availablePlayers]);

  const fixedTeams: [string, string][] =
    matchFormat === "doubles" && teamMode === "fixed"
      ? Array.from({ length: Math.floor(selectedOrder.length / 2) }, (_, i) => [
          selectedOrder[i * 2],
          selectedOrder[i * 2 + 1],
        ])
      : [];

  const preview = useMemo(() => {
    if (matchFormat === "singles") {
      return computeSinglesPreview(selectedOrder.length, numCourts, matchDurationMinutes);
    }
    if (teamMode === "fixed") {
      return computeFixedDoublesPreview(fixedTeams.length, numCourts, matchDurationMinutes);
    }
    return computeRotatingDoublesPreview(selectedOrder.length, numCourts, matchDurationMinutes, numRounds);
  }, [matchFormat, teamMode, selectedOrder.length, numCourts, matchDurationMinutes, numRounds, fixedTeams.length]);

  function toggleParticipant(id: string) {
    setSelectedOrder((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("numCourts", String(numCourts));
      formData.set("matchDurationMinutes", String(matchDurationMinutes));
      formData.set("matchFormat", matchFormat);
      selectedOrder.forEach((id) => formData.append("participantIds", id));

      if (matchFormat === "doubles") {
        formData.set("teamMode", teamMode);
        if (teamMode === "rotating") {
          formData.set("numRounds", String(numRounds));
        } else {
          fixedTeams.forEach((team) => formData.append("fixedTeams", team.join(",")));
        }
      }

      const tournamentId = await onSubmit(formData);
      router.push(`/tournaments/${tournamentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="space-y-4">
        <h2 className="font-headline text-lg font-semibold">Parameters</h2>

        <label className="flex flex-col text-sm gap-1">
          Tournament Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border border-outline-variant rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col text-sm gap-1">
          Number of Courts
          <input
            type="number"
            min={1}
            value={numCourts}
            onChange={(e) => setNumCourts(Number(e.target.value))}
            className="border border-outline-variant rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col text-sm gap-1">
          Match Duration (minutes)
          <input
            type="number"
            min={1}
            value={matchDurationMinutes}
            onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
            className="border border-outline-variant rounded px-3 py-2"
          />
        </label>

        <fieldset className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="matchFormat"
              checked={matchFormat === "singles"}
              onChange={() => setMatchFormat("singles")}
              aria-label="Singles"
            />
            Singles
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="matchFormat"
              checked={matchFormat === "doubles"}
              onChange={() => setMatchFormat("doubles")}
              aria-label="Doubles"
            />
            Doubles
          </label>
        </fieldset>

        {matchFormat === "doubles" && (
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="teamMode"
                checked={teamMode === "fixed"}
                onChange={() => setTeamMode("fixed")}
                aria-label="Fixed Teams"
              />
              Fixed Teams
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="teamMode"
                checked={teamMode === "rotating"}
                onChange={() => setTeamMode("rotating")}
                aria-label="Rotating Partners"
              />
              Rotating Partners
            </label>
          </fieldset>
        )}

        {matchFormat === "doubles" && teamMode === "rotating" && (
          <label className="flex flex-col text-sm gap-1">
            Number of Rounds
            <input
              type="number"
              min={1}
              value={numRounds}
              onChange={(e) => setNumRounds(Number(e.target.value))}
              className="border border-outline-variant rounded px-3 py-2"
            />
          </label>
        )}

        {matchFormat === "doubles" && teamMode === "fixed" && fixedTeams.length > 0 && (
          <div>
            <h3 className="font-headline text-sm font-semibold mb-2">Teams (paired in selection order)</h3>
            <ul className="space-y-1">
              {fixedTeams.map(([a, b], i) => (
                <li key={i} className="font-body text-sm">
                  {playersById.get(a)?.name} &amp; {playersById.get(b)?.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-headline text-lg font-semibold">Participants</h2>
        <ParticipantPicker
          availablePlayers={availablePlayers}
          selectedIds={selectedOrder}
          onToggle={toggleParticipant}
          onPlayerAdded={(player) => setAvailablePlayers((prev) => [...prev, player])}
          onCreatePlayer={onCreatePlayer}
        />
      </Card>

      <Card className="lg:col-span-2 flex items-center justify-between">
        <div>
          <p className="font-headline text-lg font-semibold">
            {preview.totalMatches} matches &middot; ~{Math.round(preview.estimatedMinutes / 60)} hours estimated
          </p>
          {error && <p className="text-error text-sm mt-1">{error}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Generating..." : "Generate Bracket"}
        </Button>
      </Card>
    </form>
  );
}
```

- [ ] **Step 13: Run tests to verify they pass**

Run: `npm run test -- components/tournaments/RoundRobinSetupForm.test.tsx` — expected: 2 passed.

- [ ] **Step 14: Wire up the Round Robin Setup page**

```tsx
// app/tournaments/new/page.tsx
import { getAllPlayers } from "@/lib/data/players";
import { createPlayer } from "@/lib/actions/players";
import { generateBracket } from "@/lib/actions/tournaments";
import { RoundRobinSetupForm } from "@/components/tournaments/RoundRobinSetupForm";

export default async function NewTournamentPage() {
  const allPlayers = await getAllPlayers();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-6">
      <h1 className="font-headline text-3xl font-bold">Round Robin Setup</h1>
      <RoundRobinSetupForm initialPlayers={allPlayers} onSubmit={generateBracket} onCreatePlayer={createPlayer} />
    </main>
  );
}
```

- [ ] **Step 15: Run the full test suite**

Run: `npm run test` — expected: all tests across every prior task still pass.

- [ ] **Step 16: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/tournaments/new` — select 4+ existing players (or add a new one inline), confirm the match/hour preview updates live; switch to Doubles + Fixed Teams and confirm the team pairing list appears; click "Generate Bracket" and confirm you're redirected to the new tournament's detail page (a 404 is expected here until Task 13 adds that route). Stop the server with Ctrl+C once confirmed.

- [ ] **Step 17: Commit**

```bash
git add lib/scheduling/preview.ts lib/scheduling/preview.test.ts lib/actions/tournaments.ts lib/actions/tournaments.test.ts components/tournaments app/tournaments/new/page.tsx
git commit -m "Add Round Robin Setup page and Generate Bracket action"
```

---

## Task 13: Tournament Detail page and score entry action

**Files:**
- Create: `lib/data/tournamentDetail.ts`
- Create: `lib/actions/matches.ts`
- Create: `components/tournaments/MatchScoreForm.tsx`
- Create: `app/tournaments/[id]/page.tsx`
- Test: `lib/data/tournamentDetail.test.ts`, `lib/actions/matches.test.ts`, `components/tournaments/MatchScoreForm.test.tsx`

**Interfaces:**
- Consumes: `db`, `tournaments`, `matches`, `matchParticipants`, `players` (Task 2); `Card`, `Badge`, `Button` (Task 8).
- Produces: `MatchDetail` and `TournamentDetail` types, `getTournamentDetail(tournamentId: string): Promise<TournamentDetail | null>` from `lib/data/tournamentDetail.ts`; `recordScore(matchId: string, formData: FormData): Promise<void>` from `lib/actions/matches.ts` (flips the match to `final`, and flips the tournament to `in_progress` on its first recorded score or `completed` once every match is `final`).

- [ ] **Step 1: Write the failing test for `getTournamentDetail`**

```ts
// lib/data/tournamentDetail.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTournamentDetail } from "./tournamentDetail";

describe("getTournamentDetail", () => {
  const insertedPlayerIds: string[] = [];
  let tournamentId: string | null = null;
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    if (tournamentId) await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("returns matches grouped with player names, sorted by round then court", async () => {
    const [p1] = await db.insert(players).values({ name: "__Detail P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Detail P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Detail Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentId = tournament.id;

    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 2 },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.matches).toHaveLength(1);
    expect(detail?.matches[0]).toMatchObject({
      roundNumber: 1,
      courtNumber: 1,
      status: "scheduled",
      side1PlayerNames: ["__Detail P1__"],
      side2PlayerNames: ["__Detail P2__"],
    });
  });

  it("returns null for a nonexistent tournament", async () => {
    const detail = await getTournamentDetail("00000000-0000-0000-0000-000000000000");
    expect(detail).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/data/tournamentDetail.test.ts` — expected: FAIL with "Cannot find module './tournamentDetail'".

- [ ] **Step 3: Implement `getTournamentDetail`**

```ts
// lib/data/tournamentDetail.ts
import { db } from "@/lib/db/client";
import { tournaments, matches, matchParticipants, players } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface MatchDetail {
  id: string;
  roundNumber: number;
  courtNumber: number;
  status: "scheduled" | "final";
  side1Score: number | null;
  side2Score: number | null;
  side1PlayerNames: string[];
  side2PlayerNames: string[];
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  matches: MatchDetail[];
}

export async function getTournamentDetail(tournamentId: string): Promise<TournamentDetail | null> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return null;

  const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
  const base = { id: tournament.id, name: tournament.name, status: tournament.status, matchFormat: tournament.matchFormat };
  if (matchRows.length === 0) return { ...base, matches: [] };

  const matchIds = matchRows.map((m) => m.id);
  const participantRows = await db
    .select({ matchId: matchParticipants.matchId, side: matchParticipants.side, name: players.name })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { side: number; name: string }[]>();
  for (const p of participantRows) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  const matchDetails: MatchDetail[] = matchRows
    .map((m) => {
      const participants = participantsByMatch.get(m.id) ?? [];
      return {
        id: m.id,
        roundNumber: m.roundNumber,
        courtNumber: m.courtNumber,
        status: m.status,
        side1Score: m.side1Score,
        side2Score: m.side2Score,
        side1PlayerNames: participants.filter((p) => p.side === 1).map((p) => p.name),
        side2PlayerNames: participants.filter((p) => p.side === 2).map((p) => p.name),
      };
    })
    .sort((a, b) => a.roundNumber - b.roundNumber || a.courtNumber - b.courtNumber);

  return { ...base, matches: matchDetails };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/data/tournamentDetail.test.ts` — expected: 2 passed.

- [ ] **Step 5: Write the failing tests for `recordScore`**

```ts
// lib/actions/matches.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordScore } from "./matches";

describe("recordScore", () => {
  const insertedPlayerIds: string[] = [];
  let tournamentId: string | null = null;
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    if (tournamentId) await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("flips the tournament to in_progress on the first score, then completed once all matches are final", async () => {
    const [p1] = await db.insert(players).values({ name: "__Score P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Score P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Score Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentId = tournament.id;

    const [matchA] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    const [matchB] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 2, status: "scheduled" })
      .returning();
    matchIds.push(matchA.id, matchB.id);
    await db.insert(matchParticipants).values([
      { matchId: matchA.id, playerId: p1.id, side: 1 },
      { matchId: matchA.id, playerId: p2.id, side: 2 },
      { matchId: matchB.id, playerId: p1.id, side: 1 },
      { matchId: matchB.id, playerId: p2.id, side: 2 },
    ]);

    const scoreFormA = new FormData();
    scoreFormA.set("side1Score", "11");
    scoreFormA.set("side2Score", "7");
    await recordScore(matchA.id, scoreFormA);

    const [afterFirst] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(afterFirst.status).toBe("in_progress");

    const scoreFormB = new FormData();
    scoreFormB.set("side1Score", "9");
    scoreFormB.set("side2Score", "11");
    await recordScore(matchB.id, scoreFormB);

    const [afterSecond] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(afterSecond.status).toBe("completed");

    const [updatedMatchA] = await db.select().from(matches).where(eq(matches.id, matchA.id));
    expect(updatedMatchA.status).toBe("final");
    expect(updatedMatchA.side1Score).toBe(11);
  });

  it("rejects a tied score", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Tie Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentId = tournament.id;
    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    const formData = new FormData();
    formData.set("side1Score", "5");
    formData.set("side2Score", "5");
    await expect(recordScore(match.id, formData)).rejects.toThrow("Scores cannot be tied");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm run test -- lib/actions/matches.test.ts` — expected: FAIL with "Cannot find module './matches'".

- [ ] **Step 7: Implement `recordScore`**

```ts
// lib/actions/matches.ts
"use server";

import { db } from "@/lib/db/client";
import { matches, tournaments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function recordScore(matchId: string, formData: FormData): Promise<void> {
  const side1Score = Number(formData.get("side1Score"));
  const side2Score = Number(formData.get("side2Score"));

  if (!Number.isInteger(side1Score) || side1Score < 0) {
    throw new Error("Side 1 score must be a non-negative whole number");
  }
  if (!Number.isInteger(side2Score) || side2Score < 0) {
    throw new Error("Side 2 score must be a non-negative whole number");
  }
  if (side1Score === side2Score) {
    throw new Error("Scores cannot be tied");
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) throw new Error("Match not found");

  await db
    .update(matches)
    .set({ side1Score, side2Score, status: "final", playedAt: new Date() })
    .where(eq(matches.id, matchId));

  const stillScheduled = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.tournamentId, match.tournamentId), eq(matches.status, "scheduled")));

  if (stillScheduled.length === 0) {
    await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, match.tournamentId));
  } else {
    await db
      .update(tournaments)
      .set({ status: "in_progress" })
      .where(and(eq(tournaments.id, match.tournamentId), eq(tournaments.status, "scheduled")));
  }

  revalidatePath(`/tournaments/${match.tournamentId}`);
  revalidatePath("/tournaments");
  revalidatePath("/");
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test -- lib/actions/matches.test.ts` — expected: 2 passed.

- [ ] **Step 9: Write the failing test for `MatchScoreForm`**

```tsx
// components/tournaments/MatchScoreForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchScoreForm } from "./MatchScoreForm";

describe("MatchScoreForm", () => {
  it("pre-fills existing scores and submits edited values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchScoreForm side1Score={11} side2Score={7} onSubmit={onSubmit} />);

    expect(screen.getByLabelText("Side 1 score")).toHaveValue(11);
    fireEvent.change(screen.getByLabelText("Side 2 score"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("side1Score")).toBe("11");
    expect(formData.get("side2Score")).toBe("9");
  });

  it("shows an error message if onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Scores cannot be tied"));
    render(<MatchScoreForm side1Score={null} side2Score={null} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Side 1 score"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Side 2 score"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Scores cannot be tied")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test -- components/tournaments/MatchScoreForm.test.tsx` — expected: FAIL with "Cannot find module './MatchScoreForm'".

- [ ] **Step 11: Implement `MatchScoreForm`**

```tsx
// components/tournaments/MatchScoreForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function MatchScoreForm({
  side1Score,
  side2Score,
  onSubmit,
}: {
  side1Score: number | null;
  side2Score: number | null;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        name="side1Score"
        type="number"
        min={0}
        defaultValue={side1Score ?? ""}
        aria-label="Side 1 score"
        className="border border-outline-variant rounded px-2 py-1 w-16"
      />
      <span>-</span>
      <input
        name="side2Score"
        type="number"
        min={0}
        defaultValue={side2Score ?? ""}
        aria-label="Side 2 score"
        className="border border-outline-variant rounded px-2 py-1 w-16"
      />
      <Button type="submit" variant="secondary">
        Save
      </Button>
      {error && <p className="text-error text-sm">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm run test -- components/tournaments/MatchScoreForm.test.tsx` — expected: 2 passed.

- [ ] **Step 13: Wire up the Tournament Detail page**

```tsx
// app/tournaments/[id]/page.tsx
import { notFound } from "next/navigation";
import { getTournamentDetail, type MatchDetail } from "@/lib/data/tournamentDetail";
import { recordScore } from "@/lib/actions/matches";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { MatchScoreForm } from "@/components/tournaments/MatchScoreForm";

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const tournament = await getTournamentDetail(params.id);
  if (!tournament) notFound();

  const rounds = new Map<number, MatchDetail[]>();
  for (const match of tournament.matches) {
    const list = rounds.get(match.roundNumber) ?? [];
    list.push(match);
    rounds.set(match.roundNumber, list);
  }

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <Badge>{tournament.status.replace("_", " ")}</Badge>
      </div>

      {[...rounds.entries()].map(([roundNumber, roundMatches]) => (
        <Card key={roundNumber} className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-4">Round {roundNumber}</h2>
          {roundMatches.map((match) => (
            <div key={match.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-mono text-xs text-on-surface-variant uppercase">Court {match.courtNumber}</p>
                <p className="font-body font-medium">
                  {match.side1PlayerNames.join(" & ")} vs. {match.side2PlayerNames.join(" & ")}
                </p>
              </div>
              <MatchScoreForm
                side1Score={match.side1Score}
                side2Score={match.side2Score}
                onSubmit={recordScore.bind(null, match.id)}
              />
            </div>
          ))}
        </Card>
      ))}
    </main>
  );
}
```

- [ ] **Step 14: Manually verify in the browser**

Run: `npm run dev`, generate a tournament via `/tournaments/new`, land on its detail page — expected: matches grouped by round with court numbers and player names; enter a score for one match, click Save, confirm the tournament badge changes to "in progress"; enter scores for every remaining match, confirm the badge changes to "completed". Also visit `/players/[id]` for one of the participants and confirm their Match History (Task 10) now shows the recorded result. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 15: Commit**

```bash
git add lib/data/tournamentDetail.ts lib/data/tournamentDetail.test.ts lib/actions/matches.ts lib/actions/matches.test.ts components/tournaments/MatchScoreForm.tsx components/tournaments/MatchScoreForm.test.tsx "app/tournaments/[id]/page.tsx"
git commit -m "Add Tournament Detail page with score entry and completion tracking"
```

---

## Task 14: Standings page

**Files:**
- Modify: `lib/standings.ts` (add `sortStandings`, `standingsToCsv`, `StandingsSort` type)
- Modify: `lib/standings.test.ts` (add tests for the two new functions)
- Create: `components/standings/StandingsTable.tsx`
- Create: `app/standings/page.tsx`
- Test: `components/standings/StandingsTable.test.tsx`

**Interfaces:**
- Consumes: `StandingRow` type, `getStandings()` (Task 10); `Avatar`, `Card`, `Button` (Tasks 7-8).
- Produces: `StandingsSort` type (`"wins" | "winPercentage"`); `sortStandings(rows: StandingRow[], sortBy: StandingsSort): StandingRow[]`; `standingsToCsv(rows: StandingRow[]): string` — both added to `lib/standings.ts` alongside the existing `rankPlayerByWins`.

- [ ] **Step 1: Write the failing tests for the new pure functions**

Append to `lib/standings.test.ts`:

```ts
import { sortStandings, standingsToCsv } from "./standings";

describe("sortStandings", () => {
  it("sorts by wins descending", () => {
    const standings = [row("a", 5), row("b", 10), row("c", 2)];
    expect(sortStandings(standings, "wins").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by win percentage descending", () => {
    const standings: StandingRow[] = [
      { ...row("a", 5), winPercentage: 90 },
      { ...row("b", 10), winPercentage: 50 },
      { ...row("c", 2), winPercentage: 99 },
    ];
    expect(sortStandings(standings, "winPercentage").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const standings = [row("a", 5), row("b", 10)];
    const original = [...standings];
    sortStandings(standings, "wins");
    expect(standings).toEqual(original);
  });
});

describe("standingsToCsv", () => {
  it("produces a header row plus one row per player, ranked by input order", () => {
    const standings = [row("a", 10), row("b", 5)];
    const csv = standingsToCsv(standings);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Rank,Player,DUPR Rating,Wins,Win %,Matches Played");
    expect(lines[1]).toBe("1,a,4.00,10,50,11");
    expect(lines[2]).toBe("2,b,4.00,5,50,6");
  });

  it("quotes player names containing a comma", () => {
    const standings: StandingRow[] = [{ ...row("a", 1), name: "Smith, Jr." }];
    const csv = standingsToCsv(standings);
    expect(csv.split("\n")[1]).toBe('1,"Smith, Jr.",4.00,1,50,2');
  });
});
```

(`row(id, wins)` is the existing test helper already defined at the top of `lib/standings.test.ts` from Task 10.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/standings.test.ts` — expected: FAIL with "sortStandings is not exported" / "standingsToCsv is not exported".

- [ ] **Step 3: Implement `sortStandings` and `standingsToCsv`**

Append to `lib/standings.ts`:

```ts
export type StandingsSort = "wins" | "winPercentage";

export function sortStandings(rows: StandingRow[], sortBy: StandingsSort): StandingRow[] {
  return [...rows].sort((a, b) => b[sortBy] - a[sortBy]);
}

export function standingsToCsv(rows: StandingRow[]): string {
  const header = "Rank,Player,DUPR Rating,Wins,Win %,Matches Played";
  const lines = rows.map(
    (row, i) => `${i + 1},${escapeCsvField(row.name)},${row.duprRating},${row.wins},${row.winPercentage},${row.matchesPlayed}`
  );
  return [header, ...lines].join("\n");
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/standings.test.ts` — expected: 8 passed (2 from Task 10 + 6 new).

- [ ] **Step 5: Write the failing test for `StandingsTable`**

```tsx
// components/standings/StandingsTable.test.tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StandingsTable } from "./StandingsTable";
import type { StandingRow } from "@/lib/standings";

const standings: StandingRow[] = [
  { id: "a", name: "Alex", duprRating: "4.50", wins: 5, matchesPlayed: 10, winPercentage: 90, trend: "flat" },
  { id: "b", name: "Bo", duprRating: "4.00", wins: 8, matchesPlayed: 9, winPercentage: 50, trend: "up" },
  { id: "c", name: "Cy", duprRating: "3.80", wins: 2, matchesPlayed: 4, winPercentage: 99, trend: "down" },
];

beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
});

describe("StandingsTable", () => {
  it("defaults to sorting by wins descending", () => {
    render(<StandingsTable initialStandings={standings} />);
    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(within(rows[0]).getByText("Bo")).toBeInTheDocument();
  });

  it("re-sorts by win percentage when that tab is clicked", () => {
    render(<StandingsTable initialStandings={standings} />);
    fireEvent.click(screen.getByRole("button", { name: "Win %" }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Cy")).toBeInTheDocument();
  });

  it("generates a CSV blob when Export CSV is clicked", () => {
    render(<StandingsTable initialStandings={standings} />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- components/standings/StandingsTable.test.tsx` — expected: FAIL with "Cannot find module './StandingsTable'".

- [ ] **Step 7: Implement `StandingsTable`**

```tsx
// components/standings/StandingsTable.tsx
"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { sortStandings, standingsToCsv, type StandingRow, type StandingsSort } from "@/lib/standings";

const PLACE_LABELS = ["1st Place", "2nd Place", "3rd Place"];

export function StandingsTable({ initialStandings }: { initialStandings: StandingRow[] }) {
  const [sortBy, setSortBy] = useState<StandingsSort>("wins");
  const sorted = useMemo(() => sortStandings(initialStandings, sortBy), [initialStandings, sortBy]);
  const top3 = sorted.slice(0, 3);

  function handleExport() {
    const csv = standingsToCsv(sorted);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "standings.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("wins")}
            className={`px-3 py-1.5 rounded text-sm font-body ${
              sortBy === "wins" ? "bg-secondary text-on-secondary" : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            Wins
          </button>
          <button
            onClick={() => setSortBy("winPercentage")}
            className={`px-3 py-1.5 rounded text-sm font-body ${
              sortBy === "winPercentage" ? "bg-secondary text-on-secondary" : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            Win %
          </button>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((row, i) => (
          <Card key={row.id}>
            <Avatar name={row.name} />
            <p className="font-headline text-lg font-bold mt-2">{row.name}</p>
            <p className="font-mono text-xs text-on-surface-variant uppercase">{PLACE_LABELS[i]}</p>
            <div className="flex gap-6 mt-3">
              <div>
                <p className="font-mono text-xs text-on-surface-variant">WINS</p>
                <p className="font-headline text-xl font-bold">{row.wins}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-on-surface-variant">WIN %</p>
                <p className="font-headline text-xl font-bold">{row.winPercentage}%</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <table className="w-full">
          <thead>
            <tr className="text-left font-mono text-xs text-on-surface-variant uppercase border-b border-surface-container-high">
              <th className="p-4">Rank</th>
              <th className="p-4">Player</th>
              <th className="p-4">DUPR</th>
              <th className="p-4">Wins</th>
              <th className="p-4">Win %</th>
              <th className="p-4">Matches</th>
              <th className="p-4">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.id} className="border-b border-surface-container-high last:border-0">
                <td className="p-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name} size="sm" />
                    {row.name}
                  </div>
                </td>
                <td className="p-4 font-mono">{row.duprRating}</td>
                <td className="p-4">{row.wins}</td>
                <td className="p-4">{row.winPercentage}%</td>
                <td className="p-4">{row.matchesPlayed}</td>
                <td className="p-4">{row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- components/standings/StandingsTable.test.tsx` — expected: 3 passed.

- [ ] **Step 9: Wire up the Standings page**

```tsx
// app/standings/page.tsx
import { getStandings } from "@/lib/data/standings";
import { StandingsTable } from "@/components/standings/StandingsTable";

export default async function StandingsPage() {
  const standings = await getStandings();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-6">
      <h1 className="font-headline text-3xl font-bold">Standings</h1>
      <StandingsTable initialStandings={standings} />
    </main>
  );
}
```

- [ ] **Step 10: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/standings` — expected: top-3 cards and full table populated from real players/matches created in earlier tasks; toggling Wins/Win % re-sorts both the top-3 cards and the table; clicking Export CSV downloads a `standings.csv` file. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 11: Commit**

```bash
git add lib/standings.ts lib/standings.test.ts components/standings app/standings/page.tsx
git commit -m "Add Standings page with sort toggle and CSV export"
```

---

## Task 15: Dashboard page

**Files:**
- Create: `lib/data/dashboard.ts`
- Create: `components/dashboard/ActivityChart.tsx`
- Modify: `app/page.tsx` (replace the Task 1 placeholder)
- Test: `lib/data/dashboard.test.ts`, `components/dashboard/ActivityChart.test.tsx`

**Interfaces:**
- Consumes: `db`, `players`, `tournaments`, `matches`, `matchParticipants` (Task 2); `getStandings` (Task 10); `Card`, `StatCard`, `Avatar` (Tasks 7-8).
- Produces: `getDashboardStats(): Promise<{ activePlayers: number; ongoingMatches: number; avgMatchDurationMinutes: number }>`; `DailyActivity` type and `getMatchActivityLast7Days(): Promise<DailyActivity[]>`; `DashboardMatch` type and `getRecentMatches(limit?): Promise<DashboardMatch[]>` / `getUpcomingMatches(limit?): Promise<DashboardMatch[]>`; `TopPerformer` type and `getTopPerformer(minMatches?): Promise<TopPerformer | null>` — all from `lib/data/dashboard.ts`.

- [ ] **Step 1: Write the failing data-layer tests**

```ts
// lib/data/dashboard.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getDashboardStats,
  getMatchActivityLast7Days,
  getRecentMatches,
  getUpcomingMatches,
  getTopPerformer,
} from "./dashboard";

describe("dashboard data layer", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("computes stats, activity, recent/upcoming matches, and top performer together", async () => {
    const [p1] = await db.insert(players).values({ name: "__Dash P1__", duprRating: "4.50" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Dash P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Dash Tournament__", numCourts: 1, matchDurationMinutes: 40, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const now = new Date();
    const [finalMatch] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 3,
        status: "final",
        playedAt: now,
      })
      .returning();
    const [finalMatch2] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 2,
        side1Score: 11,
        side2Score: 2,
        status: "final",
        playedAt: now,
      })
      .returning();
    const [finalMatch3] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 3,
        side1Score: 11,
        side2Score: 9,
        status: "final",
        playedAt: now,
      })
      .returning();
    const [scheduledMatch] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 4, status: "scheduled" })
      .returning();
    insertedMatchIds.push(finalMatch.id, finalMatch2.id, finalMatch3.id, scheduledMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: finalMatch.id, playerId: p1.id, side: 1 },
      { matchId: finalMatch.id, playerId: p2.id, side: 2 },
      { matchId: finalMatch2.id, playerId: p1.id, side: 1 },
      { matchId: finalMatch2.id, playerId: p2.id, side: 2 },
      { matchId: finalMatch3.id, playerId: p1.id, side: 1 },
      { matchId: finalMatch3.id, playerId: p2.id, side: 2 },
      { matchId: scheduledMatch.id, playerId: p1.id, side: 1 },
      { matchId: scheduledMatch.id, playerId: p2.id, side: 2 },
    ]);

    const stats = await getDashboardStats();
    expect(stats.activePlayers).toBeGreaterThanOrEqual(2);
    expect(stats.ongoingMatches).toBeGreaterThanOrEqual(1);
    expect(stats.avgMatchDurationMinutes).toBeGreaterThan(0);

    const activity = await getMatchActivityLast7Days();
    expect(activity).toHaveLength(7);
    const totalCounted = activity.reduce((sum, d) => sum + d.count, 0);
    expect(totalCounted).toBeGreaterThanOrEqual(3);

    const recent = await getRecentMatches(10);
    const recentIds = recent.map((m) => m.matchId);
    expect(recentIds).toContain(finalMatch.id);
    expect(recentIds).not.toContain(scheduledMatch.id);

    const upcoming = await getUpcomingMatches(10);
    const upcomingIds = upcoming.map((m) => m.matchId);
    expect(upcomingIds).toContain(scheduledMatch.id);
    expect(upcomingIds).not.toContain(finalMatch.id);

    const topPerformer = await getTopPerformer(3);
    expect(topPerformer?.id).toBe(p1.id); // 3-0 record, only eligible player with >= 3 matches
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/data/dashboard.test.ts` — expected: FAIL with "Cannot find module './dashboard'".

- [ ] **Step 3: Implement the dashboard data layer**

```ts
// lib/data/dashboard.ts
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq, sql, and, gte, desc, asc, inArray } from "drizzle-orm";
import { getStandings } from "./standings";

export interface DashboardStats {
  activePlayers: number;
  ongoingMatches: number;
  avgMatchDurationMinutes: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [{ count: activePlayers }] = await db.select({ count: sql<number>`count(*)::int` }).from(players);
  const [{ count: ongoingMatches }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(eq(matches.status, "scheduled"));
  const [{ avg }] = await db
    .select({ avg: sql<number | null>`avg(${tournaments.matchDurationMinutes})` })
    .from(tournaments);

  return {
    activePlayers,
    ongoingMatches,
    avgMatchDurationMinutes: avg ? Math.round(Number(avg)) : 0,
  };
}

export interface DailyActivity {
  date: string;
  count: number;
}

export async function getMatchActivityLast7Days(): Promise<DailyActivity[]> {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ playedAt: matches.playedAt })
    .from(matches)
    .where(and(eq(matches.status, "final"), gte(matches.playedAt, start)));

  const countsByDate = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    countsByDate.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    if (!row.playedAt) continue;
    const key = row.playedAt.toISOString().slice(0, 10);
    if (countsByDate.has(key)) {
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }
  }

  return [...countsByDate.entries()].map(([date, count]) => ({ date, count }));
}

export interface DashboardMatch {
  matchId: string;
  tournamentName: string;
  side1PlayerNames: string[];
  side2PlayerNames: string[];
  side1Score: number | null;
  side2Score: number | null;
  status: "scheduled" | "final";
}

async function getMatchesByStatus(status: "scheduled" | "final", limit: number): Promise<DashboardMatch[]> {
  const rows = await db
    .select({
      matchId: matches.id,
      tournamentName: tournaments.name,
      side1Score: matches.side1Score,
      side2Score: matches.side2Score,
      status: matches.status,
    })
    .from(matches)
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(matches.status, status))
    .orderBy(status === "final" ? desc(matches.playedAt) : asc(matches.roundNumber))
    .limit(limit);

  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.matchId);
  const participantRows = await db
    .select({ matchId: matchParticipants.matchId, side: matchParticipants.side, name: players.name })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { side: number; name: string }[]>();
  for (const p of participantRows) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  return rows.map((r) => {
    const participants = participantsByMatch.get(r.matchId) ?? [];
    return {
      matchId: r.matchId,
      tournamentName: r.tournamentName,
      side1PlayerNames: participants.filter((p) => p.side === 1).map((p) => p.name),
      side2PlayerNames: participants.filter((p) => p.side === 2).map((p) => p.name),
      side1Score: r.side1Score,
      side2Score: r.side2Score,
      status: r.status,
    };
  });
}

export async function getRecentMatches(limit = 5): Promise<DashboardMatch[]> {
  return getMatchesByStatus("final", limit);
}

export async function getUpcomingMatches(limit = 5): Promise<DashboardMatch[]> {
  return getMatchesByStatus("scheduled", limit);
}

export interface TopPerformer {
  id: string;
  name: string;
  winPercentage: number;
}

export async function getTopPerformer(minMatches = 3): Promise<TopPerformer | null> {
  const standings = await getStandings();
  const eligible = standings.filter((s) => s.matchesPlayed >= minMatches);
  if (eligible.length === 0) return null;

  const [top] = [...eligible].sort((a, b) => b.winPercentage - a.winPercentage);
  return { id: top.id, name: top.name, winPercentage: top.winPercentage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/data/dashboard.test.ts` — expected: 1 passed.

- [ ] **Step 5: Write the failing test for `ActivityChart`**

```tsx
// components/dashboard/ActivityChart.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityChart } from "./ActivityChart";

describe("ActivityChart", () => {
  it("renders one bar per day with a title showing the match count", () => {
    const data = [
      { date: "2026-07-08", count: 2 },
      { date: "2026-07-09", count: 0 },
      { date: "2026-07-10", count: 5 },
      { date: "2026-07-11", count: 1 },
      { date: "2026-07-12", count: 3 },
      { date: "2026-07-13", count: 0 },
      { date: "2026-07-14", count: 4 },
    ];
    render(<ActivityChart data={data} />);
    expect(screen.getByTitle("5 matches")).toBeInTheDocument();
    expect(screen.getByTitle("0 matches")).toBeInTheDocument();
    expect(screen.getAllByTitle(/matches$/)).toHaveLength(7);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- components/dashboard/ActivityChart.test.tsx` — expected: FAIL with "Cannot find module './ActivityChart'".

- [ ] **Step 7: Implement `ActivityChart`**

```tsx
// components/dashboard/ActivityChart.tsx
import type { DailyActivity } from "@/lib/data/dashboard";

export function ActivityChart({ data }: { data: DailyActivity[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-3 h-40">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-secondary-container rounded-t"
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${d.count} matches`}
          />
          <span className="font-mono text-xs text-on-surface-variant">
            {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- components/dashboard/ActivityChart.test.tsx` — expected: 1 passed.

- [ ] **Step 9: Replace the placeholder Dashboard page**

```tsx
// app/page.tsx
import {
  getDashboardStats,
  getMatchActivityLast7Days,
  getRecentMatches,
  getUpcomingMatches,
  getTopPerformer,
} from "@/lib/data/dashboard";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { ActivityChart } from "@/components/dashboard/ActivityChart";

export default async function DashboardPage() {
  const [stats, activity, recentMatches, upcomingMatches, topPerformer] = await Promise.all([
    getDashboardStats(),
    getMatchActivityLast7Days(),
    getRecentMatches(),
    getUpcomingMatches(),
    getTopPerformer(),
  ]);

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <h1 className="font-headline text-3xl font-bold">League Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active Players" value={String(stats.activePlayers)} />
        <StatCard label="Ongoing Matches" value={String(stats.ongoingMatches)} />
        <StatCard label="Avg. Match Time" value={`${stats.avgMatchDurationMinutes}m`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="font-headline text-lg font-semibold mb-4">Match Activity Pulse</h2>
          <ActivityChart data={activity} />
        </Card>

        <Card className="bg-primary text-on-primary">
          <p className="font-mono text-xs uppercase tracking-wide opacity-70">Top Performer</p>
          {topPerformer ? (
            <>
              <div className="flex items-center gap-3 mt-3">
                <Avatar name={topPerformer.name} />
                <p className="font-headline text-lg font-bold">{topPerformer.name}</p>
              </div>
              <p className="font-mono text-sm mt-2">{topPerformer.winPercentage}% win rate</p>
            </>
          ) : (
            <p className="mt-3 text-sm opacity-70">Not enough matches played yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-6 pb-0">Recent Matches</h2>
          {recentMatches.length === 0 && <p className="p-6 text-on-surface-variant">No matches played yet.</p>}
          {recentMatches.map((m) => (
            <div key={m.matchId} className="flex items-center justify-between p-4">
              <p className="font-body text-sm">
                {m.side1PlayerNames.join(" & ")} vs. {m.side2PlayerNames.join(" & ")}
              </p>
              <p className="font-mono text-sm font-semibold">
                {m.side1Score}-{m.side2Score}
              </p>
            </div>
          ))}
        </Card>

        <Card className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-6 pb-0">Upcoming Matches</h2>
          {upcomingMatches.length === 0 && <p className="p-6 text-on-surface-variant">No scheduled matches.</p>}
          {upcomingMatches.map((m) => (
            <div key={m.matchId} className="flex items-center justify-between p-4">
              <p className="font-body text-sm">
                {m.side1PlayerNames.join(" & ")} vs. {m.side2PlayerNames.join(" & ")}
              </p>
              <p className="font-mono text-xs text-on-surface-variant">{m.tournamentName}</p>
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Run the full test suite**

Run: `npm run test` — expected: all tests across every task pass.

- [ ] **Step 11: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/` — expected: stat cards, activity chart, top performer, and recent/upcoming match lists all populated from the real data created in earlier manual walkthroughs. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 12: Commit**

```bash
git add lib/data/dashboard.ts lib/data/dashboard.test.ts components/dashboard app/page.tsx
git commit -m "Add Dashboard page with real stats, activity chart, and match lists"
```

---

## Task 16: Netlify deployment config and final end-to-end smoke test

**Files:**
- Create: `netlify.toml`
- Modify: `.env.example` (confirm it documents every required variable)
- Modify: `README.md` (create if it doesn't exist — brief run/deploy instructions)

**Interfaces:**
- Produces: a `netlify.toml` that tells Netlify to use its Next.js runtime plugin, so `git push` (once connected to a Netlify site) builds and deploys the app with `DATABASE_URL` supplied via Netlify's environment variable settings.

- [ ] **Step 1: Write `netlify.toml`**

```toml
[build]
  command = "npm run build"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 2: Install the Netlify Next.js plugin**

Run:
```bash
npm install -D @netlify/plugin-nextjs
```

- [ ] **Step 3: Confirm `.env.example` documents every required variable**

`.env.example` should contain exactly:
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

- [ ] **Step 4: Write a short README**

```markdown
# PickleLeague Win Tracker

Single-league pickleball tournament and standings tracker. No login — every page and action is open to anyone with the link.

## Local development

1. Copy `.env.example` to `.env.local` and fill in your Neon `DATABASE_URL`.
2. `npm install`
3. `npx drizzle-kit push` (applies the schema to your Neon database)
4. `npm run dev` — visit `http://localhost:3000`

## Testing

`npm run test` runs the full Vitest suite, including integration tests that hit the real Neon database configured in `.env.local`.

## Deployment

Connect this repository to a Netlify site. Netlify builds it using `@netlify/plugin-nextjs` (configured in `netlify.toml`) and `npm run build`. Set `DATABASE_URL` in the Netlify site's environment variables (Site configuration → Environment variables) to the same Neon connection string used locally, or to a separate production Neon branch if you want to keep local dev data isolated.
```

- [ ] **Step 5: Run the full local production build**

Run: `npm run build` — expected: build completes with no type errors or failed page generation. If it fails, fix the reported errors before proceeding (do not skip this check).

- [ ] **Step 6: Run the full test suite one final time**

Run: `npm run test` — expected: every test file from Tasks 1-15 passes.

- [ ] **Step 7: Full manual end-to-end walkthrough**

Run: `npm run dev` and, in the browser, in order:
1. Visit `/players`, add 8 new players with varying DUPR ratings.
2. Visit `/tournaments/new`, create a **singles** round robin with 4 of those players, confirm the live preview showed 6 matches before submitting, and confirm you land on the new tournament's detail page with 3 rounds of matches.
3. Enter scores for every match in that tournament; confirm the status badge progresses from "scheduled" → "in progress" → "completed".
4. Visit `/tournaments/new` again, create a **doubles / fixed teams** tournament with the other 4 players (2 teams), confirm 1 match is generated, record its score.
5. Visit `/tournaments/new` again, create a **doubles / rotating partners** tournament with all 8 players and 3 rounds, confirm 3 rounds of 2 matches each are generated (8 players / 4 per match), record all scores.
6. Visit `/standings`, confirm all 8 players appear with correct wins/win % derived from the matches just played, toggle between Wins and Win % sort, and export the CSV.
7. Visit `/players/[id]` for a player who played in both the singles and doubles tournaments, confirm their match history shows all matches (with partner names shown for the doubles ones), their sparkline reflects win/loss order, and their global rank matches their position on the Standings page.
8. Visit `/` (Dashboard), confirm the stat cards, activity chart, top performer, and recent/upcoming match lists all reflect the data entered above.

Stop the dev server with Ctrl+C once every step above is confirmed working.

- [ ] **Step 8: Commit**

```bash
git add netlify.toml .env.example README.md package.json package-lock.json
git commit -m "Add Netlify deployment config and README"
```

---

## Post-Plan: Deploying to Netlify

This plan does not include actually connecting the repository to a live Netlify site or pushing to a remote — that requires the user's Netlify account and is a deployment action outside the scope of local implementation. Once every task above is complete and committed, the remaining steps are: push this repository to GitHub (or the user's preferred git host), create a new Netlify site from that repository, and set the `DATABASE_URL` environment variable in the Netlify site settings to the Neon connection string. Confirm with the user before taking any of those steps, since they affect shared/external state.
