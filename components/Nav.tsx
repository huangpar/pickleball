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
