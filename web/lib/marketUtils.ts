/**
 * Pure helpers for market UI: odds, categories (dummy format), and safe input parsing.
 * Covered by vitest — see marketUtils.test.ts.
 */

export const PM_CATEGORIES = [
  "All",
  "Crypto",
  "Politics",
  "Sports",
  "Science",
  "Culture",
] as const;

export type PmCategory = (typeof PM_CATEGORIES)[number];

/** Pool-weighted implied probability for YES (0–100). */
export function poolYesPercent(
  totalYes: bigint | undefined,
  totalNo: bigint | undefined,
): number {
  const ty = totalYes ?? 0n;
  const tn = totalNo ?? 0n;
  const t = ty + tn;
  if (t === 0n) return 50;
  return Number((ty * 10000n) / t) / 100;
}

/** Matches dummy markets like `[Crypto] #12 - Will X?` */
const BRACKET_PREFIX = /^\[([^\]]+)\]\s*/;

export function parseBracketCategory(question: string): string | null {
  const m = question.trim().match(BRACKET_PREFIX);
  return m?.[1]?.trim() ?? null;
}

/** Title without `[Category]` prefix for card display. */
export function stripCategoryPrefix(question: string): string {
  return question.replace(BRACKET_PREFIX, "").trim() || question.trim();
}

export function centsFromYesPercent(yesPct: number): { yes: number; no: number } {
  const y = Math.min(100, Math.max(0, yesPct));
  return { yes: Math.round(y), no: Math.round(100 - y) };
}

export type MarketPreviewRow = {
  addr: `0x${string}`;
  question: string;
  totalYes?: bigint;
  totalNo?: bigint;
  yesPct: number;
};

/** Browse row — mirrors polymarket.com “New · Trending · Popular · …” */
export const BROWSE_SORT_TABS = [
  { id: "new", label: "New" },
  { id: "trending", label: "Trending" },
  { id: "popular", label: "Popular" },
  { id: "liquid", label: "Liquid" },
  { id: "ending", label: "Ending Soon" },
  { id: "competitive", label: "Competitive" },
] as const;

export type BrowseSortId = (typeof BROWSE_SORT_TABS)[number]["id"];

/** Second topic strip — quick tags (polymarket.com-style). */
export const PM_QUICK_TAGS = [
  "Trending",
  "Breaking",
  "New",
  "Politics",
  "Sports",
  "Crypto",
  "Esports",
  "Finance",
  "Tech",
  "AI",
  "World",
  "Economy",
  "Elections",
] as const;

function poolVolumeWei(r: MarketPreviewRow): bigint {
  return (r.totalYes ?? 0n) + (r.totalNo ?? 0n);
}

/** Higher pool = trending / liquid first */
function cmpVolDesc(a: MarketPreviewRow, b: MarketPreviewRow): number {
  const va = poolVolumeWei(a);
  const vb = poolVolumeWei(b);
  if (vb > va) return 1;
  if (vb < va) return -1;
  return 0;
}

function cmpAddr(a: MarketPreviewRow, b: MarketPreviewRow): number {
  return a.addr.localeCompare(b.addr);
}

/** 0 = 50¢ yes (most “toss-up”); larger = more one-sided */
function competitiveScore(r: MarketPreviewRow): number {
  return Math.abs(50 - r.yesPct);
}

/**
 * Sort filtered rows per browse tab. Every tab shows the **same** markets; order differs.
 * “New” = factory enumeration order. No on-chain “end time” yet, so “Ending Soon” uses reverse order as a stand-in.
 */
export function sortMarketRows(
  rows: MarketPreviewRow[],
  sort: BrowseSortId,
): MarketPreviewRow[] {
  const copy = [...rows];
  switch (sort) {
    case "new":
      return copy;
    case "trending":
      return copy.sort((a, b) => {
        const c = cmpVolDesc(a, b);
        return c !== 0 ? c : cmpAddr(a, b);
      });
    case "popular":
      return copy.sort((a, b) => {
        const c = cmpVolDesc(a, b);
        if (c !== 0) return c;
        return competitiveScore(b) - competitiveScore(a);
      });
    case "liquid":
      return copy.sort(cmpVolDesc);
    case "ending":
      return copy.reverse();
    case "competitive":
      return copy.sort((a, b) => {
        const d = competitiveScore(a) - competitiveScore(b);
        if (d !== 0) return d;
        return cmpVolDesc(a, b);
      });
    default:
      return copy;
  }
}

export function filterMarketRows(
  rows: MarketPreviewRow[],
  opts: { search: string; category: PmCategory },
): MarketPreviewRow[] {
  const q = opts.search.trim().toLowerCase();
  let out = rows;
  if (opts.category !== "All") {
    out = out.filter((r) => parseBracketCategory(r.question) === opts.category);
  }
  if (q.length > 0) {
    out = out.filter((r) => {
      const hay = `${r.question} ${r.addr}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return out;
}

/**
 * Validates a decimal string for viem parseEther / parseUnits.
 * Rejects scientific notation, empty, negative, non-numeric junk.
 */
export function validateDecimalAmount(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = raw.trim();
  if (s.length === 0) return { ok: false, error: "Enter an amount" };
  if (s.length > 64) return { ok: false, error: "Amount too long" };
  if (!/^\d*\.?\d+$/.test(s)) return { ok: false, error: "Use digits and one decimal point only" };
  const parts = s.split(".");
  if (parts.length > 2) return { ok: false, error: "Invalid number" };
  if (parts[0] && parts[0].length > 1 && parts[0].startsWith("0")) {
    return { ok: false, error: "Remove leading zeros" };
  }
  if (parts[1] && parts[1].length > 18) {
    return { ok: false, error: "Too many decimal places (max 18)" };
  }
  if (s === "." || s === ".0") return { ok: false, error: "Invalid amount" };
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Amount must be positive" };
  return { ok: true, value: s };
}

/** Strip control chars / angle brackets for defense-in-depth (React escapes, but logs/copy matter). */
export function sanitizeQuestionPreview(s: string, maxLen = 400): string {
  const t = s.replace(/[\u0000-\u001f\u007f<>]/g, "").slice(0, maxLen);
  return t.trim() || "Untitled market";
}
