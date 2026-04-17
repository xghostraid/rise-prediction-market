"use client";

type Point = { t: number; yesPct: number };

export function MarketPriceChart({ data, label = "Implied Yes (session)" }: { data: Point[]; label?: string }) {
  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-bg)]/50 px-4 py-8 text-center text-[12px] text-[#6e7681]">
        Chart fills as this market updates (pool-weighted Yes %).
      </div>
    );
  }

  const w = 320;
  const h = 120;
  const pad = 8;
  const ys = data.map((d) => d.yesPct);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 100);
  const yRange = maxY - minY || 1;
  const t0 = data[0]!.t;
  const t1 = data[data.length - 1]!.t;
  const tRange = t1 - t0 || 1;

  const pts = data.map((d) => {
    const x = pad + ((d.t - t0) / tRange) * (w - 2 * pad);
    const y = h - pad - ((d.yesPct - minY) / yRange) * (h - 2 * pad);
    return `${x},${y}`;
  });

  const pathD = `M ${pts.join(" L ")}`;

  return (
    <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6e7681]">{label}</p>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="yesLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--rise-primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--rise-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
          fill="url(#yesLine)"
          opacity={0.6}
        />
        <path d={pathD} fill="none" stroke="var(--rise-primary)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <p className="mt-1 text-[10px] text-[#6e7681]">Session snapshots — not on-chain history.</p>
    </div>
  );
}
