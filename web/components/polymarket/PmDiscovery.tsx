"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { formatUnits } from "viem";
import type { BrowseSortId } from "@/lib/marketUtils";
import type { MarketPreviewRow } from "@/lib/marketUtils";
import { centsFromYesPercent, sanitizeQuestionPreview, stripCategoryPrefix } from "@/lib/marketUtils";
import { pmGradientFromAddr } from "@/lib/pmVisual";

type Props = {
  listRows: MarketPreviewRow[];
  selected: `0x${string}` | undefined;
  onSelect: (addr: `0x${string}`) => void;
  sortTab: BrowseSortId;
  watchHas?: (addr: `0x${string}`) => boolean;
  onWatchToggle?: (addr: `0x${string}`) => void;
  watchOnly?: boolean;
  onWatchOnlyChange?: (v: boolean) => void;
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
  listRows,
  selected,
  onSelect,
  sortTab,
  watchHas,
  onWatchToggle,
  watchOnly = false,
  onWatchOnlyChange,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: listRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 132,
    overscan: 12,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* All markets — title + toolbar row */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[20px] font-bold tracking-tight text-white md:text-[22px]">
          All markets
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#8b949e]">
          <span className="rounded-md border border-[var(--pm-border)] bg-[var(--pm-surface)] px-2.5 py-1 font-medium text-[#c9d1d9]">
            Pool volume
          </span>
          {onWatchOnlyChange ? (
            <>
              <span className="text-[#484f58]">·</span>
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-[#c9d1d9]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-[var(--pm-border)] bg-[var(--pm-bg)] accent-[var(--pm-yes)]"
                  checked={watchOnly}
                  onChange={(e) => onWatchOnlyChange(e.target.checked)}
                />
                Watchlist only
              </label>
            </>
          ) : null}
          <span className="text-[#484f58]">·</span>
          <span>Sort: {sortTab}</span>
          <span className="text-[#484f58]">·</span>
          <span>{listRows.length} listed</span>
        </div>
      </div>

      {listRows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/50 py-24 text-center">
          <p className="text-[16px] font-semibold text-white">No markets in this view</p>
          <p className="mt-2 max-w-sm text-[14px] text-[#8b949e]">
            Adjust search, topics, or sort — or clear filters to see everything.
          </p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="pm-scroll min-h-[420px] flex-1 overflow-auto rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] pr-0.5"
        >
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const row = listRows[vi.index];
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
                  <div className="relative">
                    {onWatchToggle && watchHas ? (
                      <button
                        type="button"
                        aria-label={
                          watchHas(row.addr) ? "Remove from watchlist" : "Add to watchlist"
                        }
                        className="absolute right-1 top-1 z-10 rounded-md p-1.5 text-[17px] leading-none text-[#e3b341] hover:bg-white/10 sm:right-2 sm:top-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onWatchToggle(row.addr);
                        }}
                      >
                        {watchHas(row.addr) ? "★" : "☆"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSelect(row.addr)}
                      className={`mb-2 flex w-full flex-col gap-3 rounded-xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-4 sm:p-3.5 ${
                        active
                          ? "border-[var(--pm-yes)]/50 bg-[#0f1915] shadow-[0_0_0_1px_rgba(0,211,149,0.22)]"
                          : "border-[var(--pm-border)] bg-[var(--pm-surface)] hover:border-white/[0.12] hover:bg-[var(--pm-surface-2)]"
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
                      <p className="mt-1 text-[12px] text-[#6e7681]">{vol}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:ml-auto">
                      <span
                        className="flex min-h-[40px] min-w-[5.25rem] items-center justify-center rounded-lg bg-[var(--pm-yes)] text-[14px] font-bold tabular-nums text-[#0b0e11] shadow-sm"
                        style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.15)" }}
                      >
                        Yes {yes}¢
                      </span>
                      <span className="flex min-h-[40px] min-w-[5.25rem] items-center justify-center rounded-lg bg-[var(--pm-no)] text-[14px] font-bold tabular-nums text-white shadow-sm">
                        No {no}¢
                      </span>
                    </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
