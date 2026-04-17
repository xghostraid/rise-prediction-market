"use client";

import { useMemo, useEffect, useState } from "react";
import { useReadContracts } from "wagmi";
import {
  createPublicClient,
  formatUnits,
  http,
  parseAbiItem,
  zeroAddress,
} from "viem";
import { riseTestnet } from "@/lib/chains";
import { marketAbi, erc20Abi } from "@/lib/abi";
import type { MarketPreviewRow } from "@/lib/marketUtils";
import { sanitizeQuestionPreview, stripCategoryPrefix } from "@/lib/marketUtils";
import { riseExplorerBlockUrl, riseExplorerTxUrl } from "@/lib/riseExplorer";
import { indexerFetchMarketEvents, hasIndexer, type IndexerEvent } from "@/lib/indexerClient";

const betYes = parseAbiItem(
  "event BetYes(address indexed user, uint256 amount)",
);
const betNo = parseAbiItem(
  "event BetNo(address indexed user, uint256 amount)",
);
const claimed = parseAbiItem(
  "event Claimed(address indexed user, uint256 payout)",
);
const resolved = parseAbiItem(
  "event Resolved(uint8 outcome, uint64 claimsOpenAt)",
);

const CHUNK = 20_000n;

type Row = {
  blockNumber: bigint;
  logIndex: number;
  txHash: string;
  market: `0x${string}`;
  kind: "Yes" | "No" | "Claim" | "Resolved";
  amount: bigint;
  outcome?: number;
};

type Props = {
  rpcUrl: string;
  marketAddresses: `0x${string}`[];
  previewRows: MarketPreviewRow[];
  onOpenMarket: (addr: `0x${string}`) => void;
};

async function fetchLogsChunked(
  client: ReturnType<typeof createPublicClient>,
  opts: {
    addresses: `0x${string}`[];
    fromBlock: bigint;
    toBlock: bigint;
  },
) {
  const out: {
    yes: Awaited<ReturnType<typeof client.getLogs>>;
    no: Awaited<ReturnType<typeof client.getLogs>>;
    claim: Awaited<ReturnType<typeof client.getLogs>>;
    resolved: Awaited<ReturnType<typeof client.getLogs>>;
  } = { yes: [], no: [], claim: [], resolved: [] };

  let start = opts.fromBlock;
  while (start <= opts.toBlock) {
    const end = start + CHUNK - 1n > opts.toBlock ? opts.toBlock : start + CHUNK - 1n;
    const [yes, no, claim, res] = await Promise.all([
      client.getLogs({
        address: opts.addresses,
        event: betYes,
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: opts.addresses,
        event: betNo,
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: opts.addresses,
        event: claimed,
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: opts.addresses,
        event: resolved,
        fromBlock: start,
        toBlock: end,
      }),
    ]);
    out.yes.push(...yes);
    out.no.push(...no);
    out.claim.push(...claim);
    out.resolved.push(...res);
    start = end + 1n;
  }
  return out;
}

export function ActivityView({ rpcUrl, marketAddresses, previewRows, onOpenMarket }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const questionByAddr = new Map(previewRows.map((r) => [r.addr.toLowerCase(), r.question]));

  const collateralReads = useReadContracts({
    allowFailure: true,
    contracts: marketAddresses.map((addr) => ({
      chainId: 11155931,
      address: addr,
      abi: marketAbi,
      functionName: "collateral" as const,
    })),
    query: { enabled: marketAddresses.length > 0 },
  });

  const uniqueTokens = useMemo(() => {
    const d = collateralReads.data;
    if (!d) return [] as `0x${string}`[];
    const seen = new Map<string, `0x${string}`>();
    for (let i = 0; i < marketAddresses.length; i++) {
      const r = d[i];
      const coll =
        r?.status === "success" ? (r.result as `0x${string}`) : undefined;
      if (coll && coll !== zeroAddress) {
        const k = coll.toLowerCase();
        if (!seen.has(k)) seen.set(k, coll);
      }
    }
    return [...seen.values()];
  }, [collateralReads.data, marketAddresses.length]);

  const decimalsRead = useReadContracts({
    allowFailure: true,
    contracts: uniqueTokens.map((token) => ({
      chainId: 11155931,
      address: token,
      abi: erc20Abi,
      functionName: "decimals" as const,
    })),
    query: { enabled: uniqueTokens.length > 0 },
  });

  const decimalsByMarket = useMemo(() => {
    const m = new Map<string, number>();
    const d = collateralReads.data;
    const decMap = new Map<string, number>();
    uniqueTokens.forEach((t, i) => {
      const r = decimalsRead.data?.[i];
      const dec =
        r?.status === "success" && typeof r.result === "number" ? r.result : 18;
      decMap.set(t.toLowerCase(), dec);
    });
    if (!d) return m;
    for (let i = 0; i < marketAddresses.length; i++) {
      const addr = marketAddresses[i]!;
      const r = d[i];
      const coll =
        r?.status === "success" ? (r.result as `0x${string}`) : undefined;
      const isEth = !coll || coll === zeroAddress;
      const dec = isEth ? 18 : (decMap.get(coll!.toLowerCase()) ?? 18);
      m.set(addr.toLowerCase(), dec);
    }
    return m;
  }, [collateralReads.data, decimalsRead.data, marketAddresses, uniqueTokens]);

  useEffect(() => {
    if (marketAddresses.length === 0) return;
    let cancelled = false;
    setStatus("loading");
    setErrMsg(null);
    setScanNote(null);

    const client = createPublicClient({
      chain: riseTestnet,
      transport: http(rpcUrl),
    });

    (async () => {
      try {
        if (hasIndexer()) {
          const all: Row[] = [];
          for (const addr of marketAddresses) {
            const evs = await indexerFetchMarketEvents(addr, { limit: 300 });
            (evs ?? []).forEach((e: IndexerEvent) => {
              all.push({
                blockNumber: BigInt(e.block_number),
                logIndex: e.log_index,
                txHash: e.tx_hash,
                market: addr,
                kind:
                  e.kind === "BetYes"
                    ? "Yes"
                    : e.kind === "BetNo"
                      ? "No"
                      : e.kind === "Claimed"
                        ? "Claim"
                        : "Resolved",
                amount: BigInt(e.amount ?? "0"),
                outcome: e.outcome ?? undefined,
              });
            });
          }
          all.sort((a, b) => {
            if (a.blockNumber > b.blockNumber) return -1;
            if (a.blockNumber < b.blockNumber) return 1;
            return b.logIndex - a.logIndex;
          });
          if (!cancelled) {
            setRows(all.slice(0, 120));
            setScanNote("Loaded from indexer (complete history, fast).");
            setStatus("ok");
          }
          return;
        }

        const toBlock = await client.getBlockNumber();
        let fromBlock = 0n;
        let packs: Awaited<ReturnType<typeof fetchLogsChunked>>;

        try {
          packs = await fetchLogsChunked(client, {
            addresses: marketAddresses,
            fromBlock,
            toBlock,
          });
          setScanNote("Full chain history (chunked RPC scan).");
        } catch {
          fromBlock = toBlock > 200_000n ? toBlock - 200_000n : 0n;
          packs = await fetchLogsChunked(client, {
            addresses: marketAddresses,
            fromBlock,
            toBlock,
          });
          setScanNote("Last ~200k blocks (RPC range limit fallback).");
        }

        if (cancelled) return;

        const merged: Row[] = [];

        for (const log of packs.yes) {
          merged.push({
            blockNumber: log.blockNumber ?? 0n,
            logIndex: log.logIndex ?? 0,
            txHash: log.transactionHash ?? "",
            market: (log.address ?? zeroAddress) as `0x${string}`,
            kind: "Yes",
            amount: (log as { args?: { amount?: bigint } }).args?.amount ?? 0n,
          });
        }
        for (const log of packs.no) {
          merged.push({
            blockNumber: log.blockNumber ?? 0n,
            logIndex: log.logIndex ?? 0,
            txHash: log.transactionHash ?? "",
            market: (log.address ?? zeroAddress) as `0x${string}`,
            kind: "No",
            amount: (log as { args?: { amount?: bigint } }).args?.amount ?? 0n,
          });
        }
        for (const log of packs.claim) {
          merged.push({
            blockNumber: log.blockNumber ?? 0n,
            logIndex: log.logIndex ?? 0,
            txHash: log.transactionHash ?? "",
            market: (log.address ?? zeroAddress) as `0x${string}`,
            kind: "Claim",
            amount: (log as { args?: { payout?: bigint } }).args?.payout ?? 0n,
          });
        }
        for (const log of packs.resolved) {
          const o = (log as { args?: { outcome?: number | bigint } }).args?.outcome;
          merged.push({
            blockNumber: log.blockNumber ?? 0n,
            logIndex: log.logIndex ?? 0,
            txHash: log.transactionHash ?? "",
            market: (log.address ?? zeroAddress) as `0x${string}`,
            kind: "Resolved",
            amount: 0n,
            outcome: o !== undefined ? Number(o) : undefined,
          });
        }

        merged.sort((a, b) => {
          if (a.blockNumber > b.blockNumber) return -1;
          if (a.blockNumber < b.blockNumber) return 1;
          return b.logIndex - a.logIndex;
        });

        if (!cancelled) {
          setRows(merged.slice(0, 120));
          setStatus("ok");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("err");
          setErrMsg(e instanceof Error ? e.message : "Failed to load logs");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rpcUrl, marketAddresses]);

  if (marketAddresses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/50 px-6 py-16 text-center">
        <p className="text-[16px] font-semibold text-white">No markets to scan</p>
        <p className="mt-2 text-[13px] text-[#8b949e]">
          Deploy markets from the factory — activity will list bets and claims here.
        </p>
      </div>
    );
  }

  if (collateralReads.isLoading || (uniqueTokens.length > 0 && decimalsRead.isLoading)) {
    return (
      <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-6 py-16 text-center text-[#8b949e]">
        Loading collateral metadata…
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-6 py-16 text-center text-[#8b949e]">
        Loading on-chain activity…
      </div>
    );
  }

  if (status === "err") {
    return (
      <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-6 py-12 text-center">
        <p className="text-[14px] text-[#ff6b6b]">{errMsg ?? "RPC error"}</p>
        <p className="mt-2 text-[12px] text-[#8b949e]">
          Public RPCs may rate-limit. Try a dedicated endpoint in{" "}
          <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_RISE_RPC</code>.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/50 px-6 py-16 text-center">
        <p className="text-[16px] font-semibold text-white">No matching activity</p>
        <p className="mt-2 text-[13px] text-[#8b949e]">
          {scanNote ?? "No Bet / Claim / Resolved events in the scanned range."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)]">
      <div className="border-b border-[var(--pm-border)] px-4 py-3">
        <h2 className="text-[18px] font-bold text-white">Activity</h2>
        <p className="text-[12px] text-[#8b949e]">
          Bets, claims, resolutions — amounts use each market&apos;s collateral decimals.{" "}
          {scanNote ? <span className="text-[#6e7681]">{scanNote}</span> : null}
        </p>
      </div>
      <div className="max-h-[min(560px,70vh)] overflow-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-[#12161d] text-[11px] uppercase tracking-wide text-[#6e7681]">
            <tr>
              <th className="px-3 py-2">Block</th>
              <th className="px-3 py-2">Tx</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Market</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--pm-border)] text-[#c9d1d9]">
            {rows.map((r, i) => {
              const q = questionByAddr.get(r.market.toLowerCase()) ?? "";
              const title = sanitizeQuestionPreview(stripCategoryPrefix(String(q))).slice(0, 60);
              const dec = decimalsByMarket.get(r.market.toLowerCase()) ?? 18;
              const amtLabel =
                r.kind === "Resolved"
                  ? "—"
                  : formatUnits(r.amount, dec);
              const typeLabel =
                r.kind === "Resolved"
                  ? r.outcome === 1
                    ? "Resolve → YES"
                    : r.outcome === 2
                      ? "Resolve → NO"
                      : "Resolved"
                  : r.kind;

              return (
                <tr key={`${r.txHash}-${r.logIndex}-${i}`} className="hover:bg-[var(--pm-surface-2)]">
                  <td className="px-3 py-2">
                    <a
                      href={riseExplorerBlockUrl(r.blockNumber)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-[var(--rise-primary)] hover:underline"
                    >
                      {r.blockNumber.toString()}
                    </a>
                  </td>
                  <td className="max-w-[100px] truncate px-3 py-2">
                    <a
                      href={riseExplorerTxUrl(r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[10px] text-[var(--rise-primary)] hover:underline"
                    >
                      {r.txHash.slice(0, 10)}…
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.kind === "Yes"
                          ? "text-[var(--rise-primary)]"
                          : r.kind === "No"
                            ? "text-[var(--pm-no)]"
                            : r.kind === "Resolved"
                              ? "text-amber-200/90"
                              : "text-[#c9d1d9]"
                      }
                    >
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{amtLabel}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onOpenMarket(r.market)}
                      className="max-w-[200px] truncate text-left text-[var(--rise-primary)] hover:underline"
                    >
                      {title || r.market}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
