import { poolYesPercent } from "@/lib/marketUtils";

export type BetStep = {
  blockNumber: bigint;
  logIndex: number;
  kind: "yes" | "no";
  amount: bigint;
};

export type ChartPoint = { t: number; yesPct: number };

/**
 * Replay YES/NO pool adds in chain order; yields implied Yes % after each bet.
 */
export function replayImpliedYesPercents(steps: BetStep[]): { yesPct: number }[] {
  let ty = 0n;
  let tn = 0n;
  const out: { yesPct: number }[] = [];
  for (const s of steps) {
    if (s.kind === "yes") ty += s.amount;
    else tn += s.amount;
    out.push({ yesPct: poolYesPercent(ty, tn) });
  }
  return out;
}

export function subsampleEvenly<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(arr[Math.round(i * step)]!);
  }
  return out;
}
