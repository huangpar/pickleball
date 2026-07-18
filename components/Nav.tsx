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
    <header className="border-b border-surface-container-high bg-surface-container-lowest">
      <div className="max-w-container-max mx-auto px-gutter h-16 flex items-center justify-between">
        <Link href="/" className="font-headline text-xl tracking-tight">
          <span className="text-secondary font-bold">Shaughnessy</span> <span className="text-on-surface font-bold">Pickleball</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
