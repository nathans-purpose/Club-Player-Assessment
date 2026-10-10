"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { SquadGroup } from "@/lib/players/squad-groups";

export type PlayerListItem = {
  id: string;
  shirtNumber: string | null;
  fullName: string;
  squadGroup: SquadGroup | null;
  status: "none" | "draft" | "submitted";
};

type Copy = {
  search: string;
  searchPlaceholder: string;
  noMatch: string;
  combined: string;
  combinedLabel: string;
  status: Record<PlayerListItem["status"], string>;
  groups: Record<SquadGroup, string>;
};

const STATUS_CLASS: Record<PlayerListItem["status"], string> = {
  none: "border-border bg-surface-muted text-muted",
  draft: "border-scale-mid bg-scale-mid/20",
  submitted: "border-primary/40 bg-primary/10 text-primary-ink",
};

function normalize(text: string) {
  return text.toLocaleLowerCase("sv").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function PlayerList({ clubId, players, copy }: { clubId: string; players: PlayerListItem[]; copy: Copy }) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const q = normalize(query.trim());
  const shown = q
    ? players.filter((p) => normalize(p.fullName).includes(q) || (p.shirtNumber ?? "") === q)
    : players;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="text-sm font-medium">
          {copy.search}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          className="min-h-11 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
        />
      </div>

      {shown.length === 0 ? (
        <p role="status" className="text-muted">
          {copy.noMatch}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-2 pr-2">
              <Link
                href={`/klubb/${clubId}/spelare/${p.id}`}
                className="flex min-h-14 flex-1 items-center gap-3 px-4 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ink"
              >
                <span className="w-8 shrink-0 text-right font-mono text-sm text-muted">{p.shirtNumber ?? "–"}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.fullName}</span>
                  {p.squadGroup && <span className="text-sm text-muted">{copy.groups[p.squadGroup]}</span>}
                </span>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-sm ${STATUS_CLASS[p.status]}`}>
                  {copy.status[p.status]}
                </span>
              </Link>
              {p.status === "submitted" && (
                <Link
                  href={`/klubb/${clubId}/spelare/${p.id}/samlad`}
                  aria-label={copy.combinedLabel.replace("{name}", p.fullName)}
                  className="hidden min-h-11 shrink-0 items-center rounded-lg px-2 text-sm underline sm:inline-flex"
                >
                  {copy.combined}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
