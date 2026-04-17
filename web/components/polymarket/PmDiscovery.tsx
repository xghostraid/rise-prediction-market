"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { formatUnits } from "viem";
import type { MarketPreviewRow } from "@/lib/marketUtils";
import { centsFromYesPercent, sanitizeQuestionPreview, stripCategoryPrefix } from "@/lib/marketUtils";
import { pmGradientFromAddr } from "@/lib/pmVisual";

type Props = {
  rows: MarketPreviewRow[];
  selected: `0x${string}` | undefined;
  onSelect: (addr: `0x${string}`) => void;
  search: string;
  onSearchChange: (v: string) => void;
};

function poolVolumeLabel(ty: bigint | undefined, tn: bigint | undefined): string {
  const a = ty ?? 0n;
  const b = tn ?? 0n;
  const t = a + b;
  if (t === 0n) return "No liquidity yet";
  const s = formatUnits(t, 18);
  const n = Number(s);
  if (!Number.isFinite(n)) return `${s} ETH vol.`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ETH vol.`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k ETH vol.`;
  return `${n < 0.0001 ? n.toExponential(2) : n.toFixed(4)} ETH vol.`;
}

export function PmDiscovery({
  rows,
  selected,
  onSelect,
  search,
  onSearchChange,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 132,
    overscan: 12,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Hero search — polymarket.com-style prominent search */}
      <div className="shrink-0 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-white md:text-[32px]">
          Markets
        </h1>
        <p className="mt-1 text-[15px] text-[#a1a1aa]">
          Trade opinion on RISE testnet — same Yes / No flow you know from prediction markets.
        </p>
        <div className="relative mt-5">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#71717a]">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search"
            autoComplete="off"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-full border border-[var(--pm-border)] bg-[var(--pm-surface)] py-3.5 pl-12 pr-5 text-[16px] text-white placeholder:text-[#71717a] outline-none ring-[var(--pm-yes)]/20 focus:ring-2"
          />
        </div>
        <p className="mt-3 text-[13px] text-[#71717a]">
          {rows.length} market{rows.length === 1 ? "" : "s"}
          {search.trim() ? " · filtered" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/50 py-24 text-center">
          <p className="text-[16px] font-semibold text-white">No markets match</p>
          <p className="mt-2 max-w-sm text-[14px] text-[#a1a1aa]">
            Clear search or pick another topic in the bar above.
          </p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="pm-scroll min-h-[480px] flex-1 overflow-auto rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] pr-0.5"
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
              const vol = poolVolumeLabel(row.totalYes, row.totalNo);
              const thumb = pmGradientFromAddr(row.addr);

              return (
                <div
                  key={row.addr}
                  className="absolute left-0 top-0 w-full px-2"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(row.addr)}
                    className={`mb-2 flex w-full flex-col gap-3 rounded-xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-4 sm:p-3.5 ${
                      active
                        ? "border-[var(--pm-yes)]/55 bg-[#1a1d2e] shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
                        : "border-[var(--pm-border)] bg-[#141419] hover:border-white/[0.12] hover:bg-[var(--pm-surface-2)]"
                    }`}
                  >
                    <div
                      className="h-14 w-14 shrink-0 rounded-lg shadow-inner sm:h-[52px] sm:w-[52px]"
                      style={{ background: thumb }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
                        {title}
                      </p>
                      <p className="mt-1 text-[12px] text-[#71717a]">{vol}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:ml-auto">
                      <span
                        className="flex min-h-[40px] min-w-[5.25rem] items-center justify-center rounded-lg bg-[var(--pm-yes)] text-[14px] font-bold tabular-nums text-white shadow-sm"
                        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.2)" }}
                      >
                        Yes {yes}¢
                      </span>
                      <span className="flex min-h-[40px] min-w-[5.25rem] items-center justify-center rounded-lg bg-[var(--pm-no)] text-[14px] font-bold tabular-nums text-white shadow-sm">
                        No {no}¢
                      </span>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
