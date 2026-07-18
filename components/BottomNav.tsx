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
