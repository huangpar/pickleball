# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the concrete mobile-usability problems in PickleLeague — the top nav clipping links off-screen, the Standings tables overflowing horizontally with hidden columns, two page headers not stacking a title away from an adjacent button, and a cramped 2-column participant picker — using one consistent breakpoint (Tailwind's `md`, 768px) throughout.

**Architecture:** Below `md`, a new fixed bottom tab bar replaces the top nav's link row (the top bar keeps just the brand link); both Standings tables gain a second, card-based representation shown only below `md` while the existing `<table>` markup is unchanged and shown only at `md`+; two page headers and the participant picker grid get responsive stacking classes. Everything is a pure CSS/Tailwind-class change — no new data fetching, no JavaScript-driven layout switching.

**Tech Stack:** Next.js 16.2.10 (App Router) · TypeScript · Tailwind CSS · Vitest + @testing-library/react (same stack as the rest of this repo — no new dependencies)

## Global Constraints

- One breakpoint governs all of this work: Tailwind's `md` (768px). Below `md` is "mobile," at `md` and above the app is unchanged from today.
- The bottom tab bar uses text-only labels — no icons — matching this app's icon-free, typographic design system used everywhere else.
- jsdom (this repo's test environment) does not evaluate CSS media queries. Component tests can only assert that both the mobile and desktop representations exist in the DOM with the correct responsive classes — not which one is visually shown. Actual responsive behavior is confirmed manually in a real browser at the end of the plan.
- No new backend/data-layer changes — every fix here is presentation-only.

---

## Task 1: Bottom tab bar for mobile navigation

**Files:**
- Create: `components/navItems.ts`
- Create: `components/navItems.test.ts`
- Modify: `components/Nav.tsx`
- Modify: `components/Nav.test.tsx`
- Create: `components/BottomNav.tsx`
- Create: `components/BottomNav.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `NavItem` type (`{ href: string; label: string }`), `NAV_ITEMS: NavItem[]`, `isNavItemActive(pathname: string, href: string): boolean` from `components/navItems.ts` — consumed by both `Nav.tsx` and `BottomNav.tsx`. `<BottomNav />` (no props) from `components/BottomNav.tsx`.

- [ ] **Step 1: Write the failing test for `isNavItemActive`**

```ts
// components/navItems.test.ts
import { describe, it, expect } from "vitest";
import { isNavItemActive } from "./navItems";

describe("isNavItemActive", () => {
  it("matches the root path only when pathname is exactly '/'", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/tournaments", "/")).toBe(false);
  });

  it("matches non-root paths via startsWith, so nested routes still highlight", () => {
    expect(isNavItemActive("/tournaments/abc123", "/tournaments")).toBe(true);
    expect(isNavItemActive("/players", "/tournaments")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/navItems.test.ts` — expected: FAIL with "Cannot find module './navItems'".

- [ ] **Step 3: Extract the shared nav items module**

```ts
// components/navItems.ts
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/standings", label: "Standings" },
  { href: "/players", label: "Players" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/navItems.test.ts` — expected: 2 passed.

- [ ] **Step 5: Write the failing tests for the updated `Nav`**

Replace the full contents of `components/Nav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Nav } from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/standings",
}));

describe("Nav", () => {
  it("renders exactly the four required nav links", () => {
    render(<Nav />);
    const nav = screen.getByRole("navigation");
    const expected = ["Dashboard", "Tournaments", "Standings", "Players"];
    expected.forEach((label) => {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  it("highlights the link matching the current path", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Standings" }).className).toContain("bg-surface-container-high");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("bg-surface-container-high");
  });

  it("hides the link row below the md breakpoint and shows it at md and above", () => {
    render(<Nav />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("md:flex");
  });
});
```

- [ ] **Step 6: Run tests to verify the new one fails**

Run: `npm run test -- components/Nav.test.tsx` — expected: FAIL on "hides the link row below the md breakpoint..." (the `<nav>` element doesn't have `hidden md:flex` yet); the other 2 tests still pass.

- [ ] **Step 7: Update `Nav` to hide its link row below `md`**

Replace the full contents of `components/Nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "./navItems";

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-surface-container-high bg-surface-container-lowest">
      <div className="max-w-container-max mx-auto px-gutter h-16 flex items-center justify-between">
        <Link href="/" className="font-headline text-xl tracking-tight">
          <span className="text-secondary font-bold">Shaughnessy</span>{" "}
          <span className="text-on-surface font-bold">Pickleball</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-body text-sm px-4 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-surface-container-high font-medium text-on-surface"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
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

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test -- components/Nav.test.tsx` — expected: 3 passed.

- [ ] **Step 9: Write the failing tests for `BottomNav`**

```tsx
// components/BottomNav.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/players",
}));

describe("BottomNav", () => {
  it("renders exactly the four required nav links", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation");
    const expected = ["Dashboard", "Tournaments", "Standings", "Players"];
    expected.forEach((label) => {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });

  it("highlights the link matching the current path", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Players" }).className).toContain("bg-surface-container-high");
    expect(screen.getByRole("link", { name: "Dashboard" }).className).not.toContain("bg-surface-container-high");
  });

  it("is hidden at md and above, and fixed to the bottom of the viewport below md", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("md:hidden");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `npm run test -- components/BottomNav.test.tsx` — expected: FAIL with "Cannot find module './BottomNav'".

- [ ] **Step 11: Implement `BottomNav`**

```tsx
// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "./navItems";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-surface-container-lowest border-t border-surface-container-high flex items-stretch h-16">
      {NAV_ITEMS.map((item) => {
        const isActive = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex items-center justify-center font-body text-sm transition-colors ${
              isActive ? "bg-surface-container-high font-medium text-on-surface" : "text-on-surface-variant"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npm run test -- components/BottomNav.test.tsx` — expected: 3 passed.

- [ ] **Step 13: Wire `BottomNav` into the root layout**

Replace the full contents of `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { BottomNav } from "@/components/BottomNav";

const manrope = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-manrope" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Shaughnessy Pickleball",
  description: "Single-league pickleball tournament & standings tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-surface text-on-surface font-body min-h-screen pb-16 md:pb-0">
        <Nav />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
```

(`pb-16 md:pb-0` on `<body>` reserves space for the fixed bottom bar below `md` so page content never sits underneath it, and removes that padding at `md`+ where the bottom bar doesn't render.)

- [ ] **Step 14: Run the full test suite**

Run: `npm run test` — expected: all tests pass, no regressions.

- [ ] **Step 15: Commit**

```bash
git add components/navItems.ts components/navItems.test.ts components/Nav.tsx components/Nav.test.tsx components/BottomNav.tsx components/BottomNav.test.tsx app/layout.tsx
git commit -m "Add bottom tab bar for mobile navigation"
```

---

## Task 2: Card view for the global Standings table

**Files:**
- Modify: `components/standings/StandingsTable.tsx`
- Modify: `components/standings/StandingsTable.test.tsx`

**Interfaces:**
- Consumes: `StandingRow` type, `Avatar`, `Card` (all pre-existing, unchanged).
- Produces: no change to `StandingsTable`'s props or exports — this task only changes its rendered markup.

- [ ] **Step 1: Write the failing test**

Append to `components/standings/StandingsTable.test.tsx` (inside the existing `describe("StandingsTable", ...)` block, after the existing two tests):

```tsx
  it("renders both a desktop table (hidden below md) and a mobile card list (hidden at md and above) with the same rows", () => {
    render(<StandingsTable initialStandings={standings} />);

    const table = screen.getByTestId("standings-table");
    expect(table.className).toContain("hidden");
    expect(table.className).toContain("md:block");
    expect(table).toHaveTextContent("Alex");
    expect(table).toHaveTextContent("Bo");
    expect(table).toHaveTextContent("Cy");

    const cards = screen.getByTestId("standings-cards");
    expect(cards.className).toContain("md:hidden");
    expect(cards).toHaveTextContent("Alex");
    expect(cards).toHaveTextContent("Bo");
    expect(cards).toHaveTextContent("Cy");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/standings/StandingsTable.test.tsx` — expected: FAIL — `getByTestId("standings-table")` finds nothing (no `data-testid` on the table yet, and no card list exists).

- [ ] **Step 3: Add the mobile card list and responsive classes**

Replace the full contents of `components/standings/StandingsTable.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { sortStandings, type StandingRow, type StandingsSort } from "@/lib/standings";

const PLACE_LABELS = ["1st Place", "2nd Place", "3rd Place"];

export function StandingsTable({ initialStandings }: { initialStandings: StandingRow[] }) {
  const [sortBy, setSortBy] = useState<StandingsSort>("wins");
  const sorted = useMemo(() => sortStandings(initialStandings, sortBy), [initialStandings, sortBy]);
  const top3 = sorted.slice(0, 3);

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

      <Card className="p-0 hidden md:block" data-testid="standings-table">
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

      <Card className="p-0 md:hidden divide-y divide-surface-container-high" data-testid="standings-cards">
        {sorted.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
              <Avatar name={row.name} size="sm" />
              <div>
                <p className="font-body font-medium">{row.name}</p>
                <p className="font-mono text-xs text-on-surface-variant">
                  {row.duprRating} DUPR &middot; {row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-headline font-bold">{row.wins}W</p>
              <p className="font-mono text-xs text-on-surface-variant">
                {row.winPercentage}% &middot; {row.matchesPlayed}m
              </p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/standings/StandingsTable.test.tsx` — expected: 3 passed (the 2 pre-existing tests plus the new one).

- [ ] **Step 5: Commit**

```bash
git add components/standings/StandingsTable.tsx components/standings/StandingsTable.test.tsx
git commit -m "Add mobile card view to the global Standings table"
```

---

## Task 3: Card view for the per-tournament Standings table

**Files:**
- Modify: `components/tournaments/TournamentStandingsTable.tsx`
- Modify: `components/tournaments/TournamentStandingsTable.test.tsx`

**Interfaces:**
- Consumes: `StandingRow` type, `Avatar`, `Card` (all pre-existing, unchanged).
- Produces: no change to `TournamentStandingsTable`'s props or exports — this task only changes its rendered markup.

- [ ] **Step 1: Write the failing test**

Append to `components/tournaments/TournamentStandingsTable.test.tsx` (inside the existing `describe("TournamentStandingsTable", ...)` block, after the existing two tests):

```tsx
  it("renders both a desktop table (hidden below md) and a mobile card list (hidden at md and above) with the same rows", () => {
    const standings: StandingRow[] = [
      { id: "a", name: "Alex", duprRating: "4.50", wins: 3, matchesPlayed: 3, winPercentage: 100, trend: "up" },
      { id: "b", name: "Bo", duprRating: "4.00", wins: 1, matchesPlayed: 3, winPercentage: 33.3, trend: "down" },
    ];
    render(<TournamentStandingsTable standings={standings} />);

    const table = screen.getByTestId("tournament-standings-table");
    expect(table.className).toContain("hidden");
    expect(table.className).toContain("md:block");
    expect(table).toHaveTextContent("Alex");
    expect(table).toHaveTextContent("Bo");

    const cards = screen.getByTestId("tournament-standings-cards");
    expect(cards.className).toContain("md:hidden");
    expect(cards).toHaveTextContent("Alex");
    expect(cards).toHaveTextContent("Bo");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/tournaments/TournamentStandingsTable.test.tsx` — expected: FAIL — `getByTestId("tournament-standings-table")` finds nothing.

- [ ] **Step 3: Add the mobile card list and responsive classes**

Replace the full contents of `components/tournaments/TournamentStandingsTable.tsx`:

```tsx
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import type { StandingRow } from "@/lib/standings";

export function TournamentStandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <p className="text-on-surface-variant">No standings yet.</p>;
  }

  return (
    <>
      <Card className="p-0 hidden md:block" data-testid="tournament-standings-table">
        <table className="w-full">
          <thead>
            <tr className="text-left font-mono text-xs text-on-surface-variant uppercase border-b border-surface-container-high">
              <th className="p-4">Rank</th>
              <th className="p-4">Player</th>
              <th className="p-4">Wins</th>
              <th className="p-4">Win %</th>
              <th className="p-4">Matches</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr key={row.id} className="border-b border-surface-container-high last:border-0">
                <td className="p-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name} size="sm" />
                    {row.name}
                  </div>
                </td>
                <td className="p-4">{row.wins}</td>
                <td className="p-4">{row.winPercentage}%</td>
                <td className="p-4">{row.matchesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-0 md:hidden divide-y divide-surface-container-high" data-testid="tournament-standings-cards">
        {standings.map((row, i) => (
          <div key={row.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
              <Avatar name={row.name} size="sm" />
              <p className="font-body font-medium">{row.name}</p>
            </div>
            <div className="text-right">
              <p className="font-headline font-bold">{row.wins}W</p>
              <p className="font-mono text-xs text-on-surface-variant">
                {row.winPercentage}% &middot; {row.matchesPlayed}m
              </p>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/tournaments/TournamentStandingsTable.test.tsx` — expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add components/tournaments/TournamentStandingsTable.tsx components/tournaments/TournamentStandingsTable.test.tsx
git commit -m "Add mobile card view to the per-tournament Standings table"
```

---

## Task 4: Stacking page headers and a single-column participant picker on mobile

**Files:**
- Modify: `app/tournaments/page.tsx`
- Modify: `app/tournaments/[id]/page.tsx`
- Modify: `components/tournaments/ParticipantPicker.tsx`
- Create: `components/tournaments/ParticipantPicker.test.tsx`

**Interfaces:**
- No new props or exports anywhere in this task — every change is a Tailwind className adjustment.

- [ ] **Step 1: Stack the Tournaments list header below `md`**

In `app/tournaments/page.tsx`, change:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Tournaments</h1>
        <Button href="/tournaments/new">Create Tournament</Button>
      </div>
```

to:

```tsx
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold">Tournaments</h1>
        <Button href="/tournaments/new">Create Tournament</Button>
      </div>
```

- [ ] **Step 2: Stack the Tournament Detail header below `md`**

In `app/tournaments/[id]/page.tsx`, change:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <div className="flex items-center gap-3">
          <Badge>{tournament.status.replace("_", " ")}</Badge>
          {!isCompleted && <EndTournamentButton onEnd={endTournament.bind(null, tournament.id)} />}
        </div>
      </div>
```

to:

```tsx
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <div className="flex items-center gap-3">
          <Badge>{tournament.status.replace("_", " ")}</Badge>
          {!isCompleted && <EndTournamentButton onEnd={endTournament.bind(null, tournament.id)} />}
        </div>
      </div>
```

- [ ] **Step 3: Write the failing test for the participant picker grid**

```tsx
// components/tournaments/ParticipantPicker.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticipantPicker } from "./ParticipantPicker";

describe("ParticipantPicker", () => {
  it("uses a single-column grid below md and two columns at md and above", () => {
    const players = [
      { id: "1", name: "Alex Sterling", duprRating: "4.50" },
      { id: "2", name: "Ben Rivera", duprRating: "4.20" },
    ];
    render(
      <ParticipantPicker
        availablePlayers={players}
        selectedIds={[]}
        onToggle={vi.fn()}
        onPlayerAdded={vi.fn()}
        onCreatePlayer={vi.fn()}
      />
    );

    const grid = screen.getByLabelText("Alex Sterling").closest("label")!.parentElement!;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test -- components/tournaments/ParticipantPicker.test.tsx` — expected: FAIL — the grid currently only has `grid-cols-2`, not `grid-cols-1` or `md:grid-cols-2`.

- [ ] **Step 5: Update the participant grid's responsive classes**

In `components/tournaments/ParticipantPicker.tsx`, change:

```tsx
      <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
```

to:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test -- components/tournaments/ParticipantPicker.test.tsx` — expected: 1 passed.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test` — expected: all tests pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add app/tournaments/page.tsx "app/tournaments/[id]/page.tsx" components/tournaments/ParticipantPicker.tsx components/tournaments/ParticipantPicker.test.tsx
git commit -m "Stack page headers and single-column the participant picker on mobile"
```

---

## Task 5: Final mobile verification pass

**Files:**
- None (verification only — no code changes expected).

**Interfaces:**
- None.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test` — expected: every test across Tasks 1-4 and every pre-existing test passes, with no regressions.

- [ ] **Step 2: Run a production build**

Run: `npm run build` — expected: succeeds with no type errors.

- [ ] **Step 3: Manual mobile walkthrough in a real browser**

Run: `npm run dev`. Resize the browser (or use its device-emulation mode) to a 375px-wide mobile viewport, then visit every page and confirm:

1. **Every page**: the top bar shows only the brand link (no nav items), and a bottom tab bar with all 4 items (Dashboard, Tournaments, Standings, Players) is fixed to the bottom of the screen; the active tab is highlighted; page content never sits underneath the bottom bar (nothing is clipped by it, even when scrolled to the bottom of a long page).
2. **Standings page** (`/standings`): the 7-column table is replaced by a stacked card list, one per player, showing rank/avatar/name/DUPR/trend/wins/win%/matches — no horizontal overflow, no hidden columns.
3. **A tournament's Standings tab** (`/tournaments/[id]`, Standings tab): same card-list treatment for its 5-column table.
4. **Tournaments list** (`/tournaments`): the "Tournaments" heading and "Create Tournament" button stack vertically instead of crowding each other.
5. **Tournament Detail header** (`/tournaments/[id]`): the tournament name, status badge, and (if present) End Tournament button stack vertically instead of crowding.
6. **Round Robin Setup** (`/tournaments/new`): the participant picker's player list is a single column instead of two cramped columns.
7. **Resize back to a desktop width** (≥768px, e.g. 1280px) and confirm everything reverts to today's existing layout exactly: full top nav with all 4 links, no bottom tab bar, tables (not cards) on both Standings views, headers back to a single row.

Stop the dev server with Ctrl+C once every item above is confirmed.

- [ ] **Step 4: No commit needed for this task**

(This task is verification-only; if any issue is found, go back to the relevant Task 1-4 file, fix it there, and re-run that task's tests before re-verifying here.)
