"use client";

import {
  centsFromYesPercent,
  sanitizeQuestionPreview,
  stripCategoryPrefix,
  type MarketPreviewRow,
} from "@/lib/marketUtils";
import { pmGradientFromAddr } from "@/lib/pmVisual";

type Props = {
  rows: MarketPreviewRow[];
  selected: `0x${string}` | undefined;
  onSelect: (addr: `0x${string}`) => void;
};

function pickByKeywords(rows: MarketPreviewRow[], keywords: RegExp): MarketPreviewRow | null {
  for (const r of rows) {
    if (keywords.test(r.question)) return r;
  }
  return null;
}

function uniqByAddr(rows: MarketPreviewRow[]): MarketPreviewRow[] {
  const seen = new Set<string>();
  const out: MarketPreviewRow[] = [];
  for (const r of rows) {
    const k = r.addr.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function PmHeroMarquee({ rows, selected, onSelect }: Props) {
  if (rows.length === 0) return null;

  const btc =
    pickByKeywords(rows, /\b(btc|bitcoin)\b/i) ??
    pickByKeywords(rows, /(bitcoin)/i);
  const eth =
    pickByKeywords(rows, /\b(eth|ethereum)\b/i) ??
    pickByKeywords(rows, /(ethereum)/i);

  const fallback = [...rows]
    .sort((a, b) => {
      const va = (a.totalYes ?? 0n) + (a.totalNo ?? 0n);
      const vb = (b.totalYes ?? 0n) + (b.totalNo ?? 0n);
      if (vb > va) return 1;
      if (vb < va) return -1;
      return a.addr.localeCompare(b.addr);
    })
    .slice(0, 6);

  const picks = uniqByAddr([btc, eth].filter(Boolean) as MarketPreviewRow[]);
  const featured = (picks.length >= 2 ? picks : fallback).slice(0, 6);
  if (featured.length === 0) return null;

  // Duplicate for seamless marquee scroll.
  const track = [...featured, ...featured];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-white md:text-[20px]">
            Live markets
          </h2>
          <p className="mt-1 text-[12px] text-[#8b949e]">
            Auto-highlights BTC and ETH when available.
          </p>
        </div>
        <span className="hidden text-[12px] font-medium text-[#6e7681] md:inline">
          Scrolls continuously · click to open
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)]">
        <div className="pm-marquee-track flex w-max gap-3 px-3 py-3">
          {track.map((row, i) => {
            const active = selected === row.addr;
            const title = sanitizeQuestionPreview(stripCategoryPrefix(row.question));
            const thumb = pmGradientFromAddr(row.addr);
            const { yes, no } = centsFromYesPercent(row.yesPct);
            return (
              <button
                key={`${row.addr}-${i}`}
                type="button"
                onClick={() => onSelect(row.addr)}
                className={`flex w-[340px] shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                  active
                    ? "border-[var(--pm-yes)]/55 bg-[#0f1915]"
                    : "border-[var(--pm-border)] bg-[var(--pm-surface)] hover:bg-[var(--pm-surface-2)]"
                }`}
              >
                <div className="h-10 w-10 shrink-0 rounded-lg" style={{ background: thumb }} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">
                    {title}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[#6e7681]">{row.addr}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-md bg-[var(--pm-yes)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--pm-yes)]">
                    Yes {yes}%
                  </span>
                  <span className="rounded-md bg-[var(--pm-no)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--pm-no)]">
                    No {no}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[var(--pm-surface)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--pm-surface)] to-transparent" />
      </div>
    </section>
  );
}

