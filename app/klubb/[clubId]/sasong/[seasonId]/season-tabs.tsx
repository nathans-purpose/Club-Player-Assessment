"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export function SeasonTabs({ tabs, label }: { tabs: { path: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  const { clubId, seasonId } = useParams<{ clubId: string; seasonId: string }>();
  const base = `/klubb/${clubId}/sasong/${seasonId}`;
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const href = tab.path ? `${base}/${tab.path}` : base;
          const current = pathname === href;
          return (
            <li key={tab.path}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 font-medium focus-visible:outline-2 focus-visible:outline-primary-ink ${
                  current ? "border-primary text-primary-ink" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
