"use client";

import {
  centsFromYesPercent,
  parseBracketCategory,
  sanitizeQuestionPreview,
  stripCategoryPrefix,
  type MarketPreviewRow,
} from "@/lib/marketUtils";
import { pmGradientFromAddr } from "@/lib/pmVisual";
import { formatUnits } from "viem";

type Props = {
  rows: MarketPreviewRow[];
  selected: `0x${string}` | undefined;
  onSelect: (addr: `0x${string}`) => void;
  watchHas?: (addr: `0x${string}`) => boolean;
  onWatchToggle?: (addr: `0x${string}`) => void;
};

function volShort(r: MarketPreviewRow): string {
  const t = (r.totalYes ?? 0n) + (r.totalNo ?? 0n);
  if (t === 0n) return "$0 Vol.";
  const s = formatUnits(t, 18);
  const n = Number(s);
  if (!Number.isFinite(n)) return `${s} ETH vol.`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M Vol.`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k Vol.`;
  return `$${n.toFixed(2)} Vol.`;
}

export function PmFeaturedSection({
  rows,
  selected,
  onSelect,
  watchHas,
  onWatchToggle,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-[20px] font-bold tracking-tight text-white md:text-[22px]">
        Featured markets
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const { yes, no } = centsFromYesPercent(row.yesPct);
          const title = sanitizeQuestionPreview(stripCategoryPrefix(row.question));
          const cat = parseBracketCategory(row.question);
          const meta = cat ? `${cat} · RISE` : "RISE testnet";
          const active = selected === row.addr;
          const thumb = pmGradientFromAddr(row.addr);

          return (
            <div key={row.addr} className="relative">
              {onWatchToggle && watchHas ? (
                <button
                  type="button"
                  aria-label={watchHas(row.addr) ? "Remove from watchlist" : "Add to watchlist"}
                  className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-[17px] leading-none text-[#e3b341] hover:bg-white/10"
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
                className={`flex w-full flex-col overflow-hidden rounded-xl border text-left transition ${
                  active
                    ? "border-[var(--pm-yes)]/55 bg-[#0f1915] shadow-[0_0_0_1px_rgba(0,211,149,0.2)]"
                    : "border-[var(--pm-border)] bg-[var(--pm-surface)] hover:border-white/[0.12] hover:bg-[var(--pm-surface-2)]"
                }`}
              >
              <div className="flex gap-3 p-4">
                <div
                  className="h-12 w-12 shrink-0 rounded-lg"
                  style={{ background: thumb }}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-[15px] font-semibold leading-snug text-white">
                    {title}
                  </p>
                  <p className="mt-1.5 text-[12px] text-[#6e7681]">{meta}</p>
                </div>
              </div>
              <div className="mt-auto flex gap-2 border-t border-[var(--pm-border)] px-4 py-3">
                <span className="flex flex-1 items-center justify-center rounded-md bg-[var(--pm-yes)] py-2 text-[13px] font-bold tabular-nums text-[#0b0e11]">
                  Yes {yes}%
                </span>
                <span className="flex flex-1 items-center justify-center rounded-md bg-[var(--pm-no)]/90 py-2 text-[13px] font-bold tabular-nums text-white">
                  No {no}%
                </span>
              </div>
              <p className="border-t border-[var(--pm-border)] px-4 py-2 text-[11px] text-[#6e7681]">
                {volShort(row)} · Pool
              </p>
            </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
