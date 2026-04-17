"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { riseTestnet } from "@/lib/chains";
import {
  type BetStep,
  type ChartPoint,
  replayImpliedYesPercents,
  subsampleEvenly,
} from "@/lib/betLogReplay";
import { indexerFetchMarketEvents, hasIndexer } from "@/lib/indexerClient";

const betYes = parseAbiItem(
  "event BetYes(address indexed user, uint256 amount)",
);
const betNo = parseAbiItem(
  "event BetNo(address indexed user, uint256 amount)",
);

const CHUNK = 20_000n;
const MAX_CHART_POINTS = 220;
const BLOCK_BATCH = 25;

async function fetchBetLogsChunked(
  client: ReturnType<typeof createPublicClient>,
  market: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const yes: Awaited<ReturnType<typeof client.getLogs>> = [];
  const no: Awaited<ReturnType<typeof client.getLogs>> = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n;
    const [y, n] = await Promise.all([
      client.getLogs({
        address: market,
        event: betYes,
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: market,
        event: betNo,
        fromBlock: start,
        toBlock: end,
      }),
    ]);
    yes.push(...y);
    no.push(...n);
    start = end + 1n;
  }
  return { yes, no };
}

function mergeBetSteps(yesLogs: readonly unknown[], noLogs: readonly unknown[]): BetStep[] {
  const steps: BetStep[] = [];
  for (const raw of yesLogs) {
    const log = raw as {
      blockNumber?: bigint | null;
      logIndex?: number | null;
      args?: { amount?: bigint };
    };
    steps.push({
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      kind: "yes",
      amount: log.args?.amount ?? 0n,
    });
  }
  for (const raw of noLogs) {
    const log = raw as {
      blockNumber?: bigint | null;
      logIndex?: number | null;
      args?: { amount?: bigint };
    };
    steps.push({
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
      kind: "no",
      amount: log.args?.amount ?? 0n,
    });
  }
  steps.sort((a, b) => {
    if (a.blockNumber < b.blockNumber) return -1;
    if (a.blockNumber > b.blockNumber) return 1;
    return a.logIndex - b.logIndex;
  });
  return steps;
}

/**
 * Fetches BetYes/BetNo logs for one market from genesis (chunked), replays the pool,
 * and returns chart points with block timestamps (subsampled for RPC limits).
 */
export function useMarketBetLogHistory(
  rpcUrl: string,
  market: `0x${string}` | undefined,
) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ fromBlock: string; toBlock: string; steps: number } | null>(
    null,
  );

  useEffect(() => {
    if (!market) {
      setPoints([]);
      setStatus("idle");
      setError(null);
      setMeta(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);
    setPoints([]);

    const client = createPublicClient({
      chain: riseTestnet,
      transport: http(rpcUrl),
    });

    (async () => {
      try {
        if (hasIndexer()) {
          const events = await indexerFetchMarketEvents(market, { limit: 2000 });
          if (!events) throw new Error("Indexer not available");
          const steps: BetStep[] = events
            .filter((e) => e.kind === "BetYes" || e.kind === "BetNo")
            .map((e) => ({
              blockNumber: BigInt(e.block_number),
              logIndex: e.log_index,
              kind: e.kind === "BetYes" ? ("yes" as const) : ("no" as const),
              amount: BigInt(e.amount ?? "0"),
            }))
            .sort((a, b) => {
              if (a.blockNumber < b.blockNumber) return -1;
              if (a.blockNumber > b.blockNumber) return 1;
              return a.logIndex - b.logIndex;
            });

          const implied = replayImpliedYesPercents(steps);
          const paired = steps.map((s, i) => ({ step: s, yesPct: implied[i]!.yesPct }));
          const sampled =
            paired.length > MAX_CHART_POINTS
              ? subsampleEvenly(paired, MAX_CHART_POINTS)
              : paired;

          // Indexer doesn't currently store timestamps; fall back to client.getBlock for sampled blocks.
          const blockNums = [...new Set(sampled.map((p) => p.step.blockNumber))];
          const tsMap = new Map<string, bigint>();
          for (let i = 0; i < blockNums.length; i += BLOCK_BATCH) {
            const slice = blockNums.slice(i, i + BLOCK_BATCH);
            const blocks = await Promise.all(
              slice.map((bn) => client.getBlock({ blockNumber: bn })),
            );
            for (let j = 0; j < slice.length; j++) {
              const b = blocks[j];
              const bn = slice[j]!;
              if (b) tsMap.set(bn.toString(), b.timestamp);
            }
          }

          const now = BigInt(Math.floor(Date.now() / 1000));
          const chartPoints: ChartPoint[] = sampled.map((p) => {
            const ts = tsMap.get(p.step.blockNumber.toString()) ?? now;
            return { t: Number(ts) * 1000, yesPct: p.yesPct };
          });

          if (!cancelled) {
            setPoints(chartPoints);
            setMeta({ fromBlock: "indexer", toBlock: "indexer", steps: steps.length });
            setStatus("ok");
          }
          return;
        }

        const toBlock = await client.getBlockNumber();
        let fromBlock = 0n;
        let yes: Awaited<ReturnType<typeof client.getLogs>> = [];
        let no: Awaited<ReturnType<typeof client.getLogs>> = [];

        try {
          const r = await fetchBetLogsChunked(client, market, fromBlock, toBlock);
          yes = r.yes;
          no = r.no;
        } catch {
          fromBlock = toBlock > 200_000n ? toBlock - 200_000n : 0n;
          const r = await fetchBetLogsChunked(client, market, fromBlock, toBlock);
          yes = r.yes;
          no = r.no;
        }

        if (cancelled) return;

        const steps = mergeBetSteps(yes, no);
        const implied = replayImpliedYesPercents(steps);
        const paired = steps.map((s, i) => ({ step: s, yesPct: implied[i]!.yesPct }));

        const sampled =
          paired.length > MAX_CHART_POINTS
            ? subsampleEvenly(paired, MAX_CHART_POINTS)
            : paired;

        const blockNums = [...new Set(sampled.map((p) => p.step.blockNumber))];
        const tsMap = new Map<string, bigint>();

        if (blockNums.length === 0) {
          if (!cancelled) {
            setPoints([]);
            setMeta({
              fromBlock: fromBlock.toString(),
              toBlock: toBlock.toString(),
              steps: 0,
            });
            setStatus("ok");
          }
          return;
        }

        for (let i = 0; i < blockNums.length; i += BLOCK_BATCH) {
          const slice = blockNums.slice(i, i + BLOCK_BATCH);
          const blocks = await Promise.all(
            slice.map((bn) => client.getBlock({ blockNumber: bn })),
          );
          for (let j = 0; j < slice.length; j++) {
            const b = blocks[j];
            const bn = slice[j]!;
            if (b) tsMap.set(bn.toString(), b.timestamp);
          }
        }

        const now = BigInt(Math.floor(Date.now() / 1000));
        const chartPoints: ChartPoint[] = sampled.map((p) => {
          const ts = tsMap.get(p.step.blockNumber.toString()) ?? now;
          return {
            t: Number(ts) * 1000,
            yesPct: p.yesPct,
          };
        });

        if (cancelled) return;

        setPoints(chartPoints);
        setMeta({
          fromBlock: fromBlock.toString(),
          toBlock: toBlock.toString(),
          steps: steps.length,
        });
        setStatus("ok");
      } catch (e) {
        if (!cancelled) {
          setStatus("err");
          setError(e instanceof Error ? e.message : "Failed to load bet history");
          setPoints([]);
          setMeta(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rpcUrl, market]);

  return { points, status, error, meta };
}
