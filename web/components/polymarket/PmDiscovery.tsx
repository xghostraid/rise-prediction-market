"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { MarketPreviewRow } from "@/lib/marketUtils";
import { PM_CATEGORIES, centsFromYesPercent, sanitizeQuestionPreview, stripCategoryPrefix, type PmCategory } from "@/lib/marketUtils";

type Props = {
  rows: MarketPreviewRow[];
  selected: `0x${string}` | undefined;
  onSelect: (addr: `0x${string}`) => void;
  search: string;
  onSearchChange: (v: string) => void;
  category: PmCategory;
  onCategoryChange: (c: PmCategory) => void;
};

export function PmDiscovery({
  rows,
  selected,
  onSelect,
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 10,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 pb-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c6570]">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search markets"
            autoComplete="off"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] py-3 pl-11 pr-4 text-[15px] text-white placeholder:text-[#5c6570] outline-none ring-[var(--pm-yes)]/25 focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PM_CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCategoryChange(c)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? "bg-white text-[#0d1117]"
                    : "bg-white/[0.06] text-[#c9d1d9] hover:bg-white/[0.1]"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-[#8b949e]">
          {rows.length} market{rows.length === 1 ? "" : "s"}
          {search.trim() || category !== "All" ? " (filtered)" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/40 py-20 text-center">
          <p className="text-[15px] font-medium text-[#c9d1d9]">No markets match</p>
          <p className="mt-2 max-w-sm text-[13px] text-[#8b949e]">
            Try another category or clear search.
          </p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="pm-scroll min-h-[420px] flex-1 overflow-auto rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)]/30 pr-1"
        >
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              if (!row) return null;
              const active = selected === row.addr;
              const { yes, no } = centsFromYesPercent(row.yesPct);
              const title = sanitizeQuestionPreview(stripCategoryPrefix(row.question));
              return (
                <div
                  key={row.addr}
                  className="absolute left-0 top-0 w-full px-2"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(row.addr)}
                    className={`mb-2 w-full rounded-xl border text-left transition ${
                      active
                        ? "border-[var(--pm-yes)]/50 bg-[#1a222e] shadow-[0_0_0_1px_rgba(0,211,149,0.12)]"
                        : "border-[var(--pm-border)] bg-[#161b22] hover:border-white/[0.14] hover:bg-[#1c2430]"
                    }`}
                  >
                    <div className="flex gap-3 p-3.5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2d3a4d] to-[#12161d] text-lg font-semibold text-white/90">
                        {title.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-white">
                          {title}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <span className="inline-flex min-w-[4.5rem] items-center justify-center rounded-md bg-[var(--pm-yes)]/18 px-2 py-1.5 text-[13px] font-semibold tabular-nums text-[var(--pm-yes)]">
                            Yes {yes}¢
                          </span>
                          <span className="inline-flex min-w-[4.5rem] items-center justify-center rounded-md bg-[var(--pm-no)]/16 px-2 py-1.5 text-[13px] font-semibold tabular-nums text-[#ff7a7a]">
                            No {no}¢
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0-2a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"
        fill="currentColor"
      />
      <path
        d="M15.446 15.446 20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
