"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import { marketAbi, erc20Abi } from "@/lib/abi";
import type { MarketPreviewRow } from "@/lib/marketUtils";
import { sanitizeQuestionPreview, stripCategoryPrefix } from "@/lib/marketUtils";
import { riseExplorerAddressUrl } from "@/lib/riseExplorer";

type Props = {
  chainId: number;
  marketAddresses: `0x${string}`[];
  previewRows: MarketPreviewRow[];
  user: `0x${string}`;
  onOpenMarket: (addr: `0x${string}`) => void;
};

function fmtStake(v: bigint, decimals: number, isEth: boolean): string {
  const s = formatUnits(v, decimals);
  return isEth ? `${s} ETH` : s;
}

export function PortfolioView({
  chainId,
  marketAddresses,
  previewRows,
  user,
  onOpenMarket,
}: Props) {
  const stakeAndColl = useReadContracts({
    allowFailure: true,
    contracts: marketAddresses.flatMap((addr) => [
      {
        chainId,
        address: addr,
        abi: marketAbi,
        functionName: "yesStake" as const,
        args: [user],
      },
      {
        chainId,
        address: addr,
        abi: marketAbi,
        functionName: "noStake" as const,
        args: [user],
      },
      {
        chainId,
        address: addr,
        abi: marketAbi,
        functionName: "collateral" as const,
      },
    ]),
    query: {
      enabled: marketAddresses.length > 0 && !!user,
    },
  });

  const uniqueTokens = useMemo(() => {
    const d = stakeAndColl.data;
    if (!d) return [] as `0x${string}`[];
    const seen = new Map<string, `0x${string}`>();
    for (let i = 0; i < marketAddresses.length; i++) {
      const r = d[i * 3 + 2];
      const coll =
        r?.status === "success" ? (r.result as `0x${string}`) : undefined;
      if (coll && coll !== zeroAddress) {
        const k = coll.toLowerCase();
        if (!seen.has(k)) seen.set(k, coll);
      }
    }
    return [...seen.values()];
  }, [stakeAndColl.data, marketAddresses.length]);

  const decimalsRead = useReadContracts({
    allowFailure: true,
    contracts: uniqueTokens.map((token) => ({
      chainId,
      address: token,
      abi: erc20Abi,
      functionName: "decimals" as const,
    })),
    query: {
      enabled: uniqueTokens.length > 0,
    },
  });

  const decimalsByToken = useMemo(() => {
    const m = new Map<string, number>();
    uniqueTokens.forEach((t, i) => {
      const r = decimalsRead.data?.[i];
      const dec =
        r?.status === "success" && typeof r.result === "number"
          ? r.result
          : 18;
      m.set(t.toLowerCase(), dec);
    });
    return m;
  }, [uniqueTokens, decimalsRead.data]);

  const { data, isLoading, isError } = stakeAndColl;

  const questionByAddr = new Map(previewRows.map((r) => [r.addr.toLowerCase(), r.question]));

  const rows = marketAddresses
    .map((addr, i) => {
      const y =
        data?.[i * 3]?.status === "success" ? (data[i * 3].result as bigint) : 0n;
      const n =
        data?.[i * 3 + 1]?.status === "success"
          ? (data[i * 3 + 1].result as bigint)
          : 0n;
      const collRaw =
        data?.[i * 3 + 2]?.status === "success"
          ? (data[i * 3 + 2].result as `0x${string}`)
          : undefined;
      const isEth = !collRaw || collRaw === zeroAddress;
      const dec = isEth
        ? 18
        : (decimalsByToken.get(collRaw!.toLowerCase()) ?? 18);
      return { addr, yes: y, no: n, collateral: collRaw, isEth, decimals: dec };
    })
    .filter((r) => r.yes > 0n || r.no > 0n);

  if (isLoading || (uniqueTokens.length > 0 && decimalsRead.isLoading)) {
    return (
      <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-6 py-16 text-center text-[#8b949e]">
        Loading positions…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-6 py-16 text-center text-[#ff6b6b]">
        Could not load positions (RPC). Retry shortly.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/50 px-6 py-16 text-center">
        <p className="text-[17px] font-semibold text-white">No open positions</p>
        <p className="mt-2 text-[14px] text-[#8b949e]">
          Buy Yes or No on any market — positions show here with correct collateral decimals.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)]">
      <div className="border-b border-[var(--pm-border)] px-4 py-3">
        <h2 className="text-[18px] font-bold text-white">Portfolio</h2>
        <p className="text-[12px] text-[#8b949e]">Your stakes across markets (on-chain).</p>
      </div>
      <div className="divide-y divide-[var(--pm-border)]">
        {rows.map((r) => {
          const q = questionByAddr.get(r.addr.toLowerCase()) ?? "";
          const title = sanitizeQuestionPreview(stripCategoryPrefix(String(q)));
          return (
            <button
              key={r.addr}
              type="button"
              onClick={() => onOpenMarket(r.addr)}
              className="flex w-full flex-col gap-2 px-4 py-4 text-left transition hover:bg-[var(--pm-surface-2)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="line-clamp-2 text-[14px] font-medium text-white">{title}</p>
                <a
                  href={riseExplorerAddressUrl(r.addr)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-mono text-[11px] text-[var(--rise-primary)] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.addr}
                </a>
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-right text-[13px] tabular-nums sm:items-end">
                <div className="flex flex-wrap justify-end gap-x-6 gap-y-1">
                  <span className="text-[var(--rise-primary)]">
                    YES {fmtStake(r.yes, r.decimals, r.isEth)}
                  </span>
                  <span className="text-[var(--pm-no)]">
                    NO {fmtStake(r.no, r.decimals, r.isEth)}
                  </span>
                </div>
                {!r.isEth && r.collateral ? (
                  <span className="text-[10px] text-[#6e7681]">
                    ERC-20 pool · {r.collateral.slice(0, 10)}…
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
