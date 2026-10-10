"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

/** The club's main pages; the current one is marked for screen readers too. */
export function ClubNav({ links, label }: { links: { path: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  const { clubId } = useParams<{ clubId: string }>();
  return (
    <nav aria-label={label}>
      <div className="flex flex-wrap items-center gap-1">
        {links.map((link) => {
          const href = `/klubb/${clubId}/${link.path}`;
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={link.path}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary-ink ${
                current ? "bg-surface-muted text-primary-ink" : ""
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
