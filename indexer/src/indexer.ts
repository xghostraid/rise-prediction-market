import { createPublicClient, http, parseAbiItem } from "viem";
import {
  factoryAbi,
  orderbookFactoryAbi,
  marketEventsAbi,
  poolMarketReadAbi,
  orderbookMarketReadAbi,
} from "./abi.js";
import type { Db } from "./db.js";
import { getCursor, setCursor } from "./db.js";

// RISE public RPC enforces a max `eth_getLogs` block range (often 5000).
// Keep this safely under that limit.
const CHUNK = 4_000n;
const INITIAL_LOOKBACK = 200_000n;
const FACTORY_BATCH = 10;
const RPC_CONCURRENCY = 4;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitErr(e: unknown) {
  const anyE = e as any;
  if (anyE?.status === 429) return true;
  if (anyE?.cause?.status === 429) return true;
  const msg = String(anyE?.shortMessage ?? anyE?.message ?? "");
  if (msg.includes("429")) return true;
  const details = String(anyE?.details ?? "");
  return details.includes("Error 1015") || details.includes("Status: 429");
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 5_000;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimitErr(e) || attempt === 19) {
        throw e;
      }
      // Cloudflare bans can be harsh; back off aggressively.
      await sleep(delay);
      delay = Math.min(30_000, Math.floor(delay * 1.8));
    }
  }
  // unreachable
  throw new Error(`[indexer] retry loop exhausted for ${label}`);
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

const betYes = parseAbiItem("event BetYes(address indexed user, uint256 amount)");
const betNo = parseAbiItem("event BetNo(address indexed user, uint256 amount)");
const claimed = parseAbiItem("event Claimed(address indexed user, uint256 payout)");
const resolved = parseAbiItem("event Resolved(uint8 outcome, uint64 claimsOpenAt)");

async function* chunkRanges(fromBlock: bigint, toBlock: bigint) {
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n;
    yield { fromBlock: start, toBlock: end };
    start = end + 1n;
  }
}

export async function indexOnce(opts: {
  rpcUrl: string;
  factory: `0x${string}`;
  orderbookFactory?: `0x${string}`;
  db: Db;
}) {
  const client = createPublicClient({
    transport: http(opts.rpcUrl),
  });

  const head = await withRetry(() => client.getBlockNumber(), "getBlockNumber");

  // 1) Discover pool markets from MarketFactory storage (fast, no log scans).
  const mcKey = `factory:${opts.factory}:MarketCreated:lastBlock`;
  const count = await client.readContract({
    address: opts.factory,
    abi: factoryAbi,
    functionName: "marketCount",
  });
  const n = Number(count as bigint);
  for (let i = 0; i < n; i += FACTORY_BATCH) {
    const slice = Array.from({ length: Math.min(FACTORY_BATCH, n - i) }, (_, j) => i + j);
    const addrs = await mapLimit(slice, RPC_CONCURRENCY, (idx) =>
      withRetry(
        () =>
          client.readContract({
            address: opts.factory,
            abi: factoryAbi,
            functionName: "marketById",
            args: [BigInt(idx)],
          }),
        "factory.marketById",
      ),
    );
    for (let k = 0; k < addrs.length; k++) {
      const market = (addrs[k] as `0x${string}`).toLowerCase() as `0x${string}`;
      await opts.db`
        insert into markets (
          address, market_type, created_block, created_tx, factory_id, collateral, oracle, trading_ends_at, claim_delay_after_resolve, question
        ) values (
          ${market},
          'pool',
          ${0n},
          ${""},
          ${String(i + k)},
          ${"0x0000000000000000000000000000000000000000"},
          ${"0x0000000000000000000000000000000000000000"},
          ${0n},
          ${0n},
          ${""}
        )
        on conflict (address) do nothing
      `;
    }
  }
  await setCursor(opts.db, mcKey, head.toString());

  // 1b) Discover orderbook markets from factory storage (fast).
  if (opts.orderbookFactory) {
    const key = `factory:${opts.orderbookFactory}:OrderBookMarketCreated:lastBlock`;
    const count = await withRetry(
      () =>
        client.readContract({
          address: opts.orderbookFactory,
          abi: orderbookFactoryAbi,
          functionName: "marketCount",
        }),
      "orderbookFactory.marketCount",
    );
    const n = Number(count as bigint);
    for (let i = 0; i < n; i += FACTORY_BATCH) {
      const slice = Array.from({ length: Math.min(FACTORY_BATCH, n - i) }, (_, j) => i + j);
      const addrs = await mapLimit(slice, RPC_CONCURRENCY, (idx) =>
        withRetry(
          () =>
            client.readContract({
              address: opts.orderbookFactory!,
              abi: orderbookFactoryAbi,
              functionName: "marketById",
              args: [BigInt(idx)],
            }),
          "orderbookFactory.marketById",
        ),
      );
      for (let k = 0; k < addrs.length; k++) {
        const market = (addrs[k] as `0x${string}`).toLowerCase() as `0x${string}`;
        await opts.db`
          insert into markets (
            address, market_type, created_block, created_tx, factory_id, collateral, oracle, trading_ends_at, claim_delay_after_resolve, question
          ) values (
            ${market},
            'orderbook',
            ${0n},
            ${""},
            ${String(i + k)},
            ${"0x0000000000000000000000000000000000000000"},
            ${"0x0000000000000000000000000000000000000000"},
            ${0n},
            ${0n},
            ${""}
          )
          on conflict (address) do nothing
        `;
      }
    }
    await setCursor(opts.db, key, head.toString());
  }

  // 2) Enrich newly-discovered markets with on-chain metadata (cheap view calls).
  // Do this before any heavy event indexing so `/markets` becomes useful fast.
  const toEnrich = await opts.db<
    { address: string; market_type: "pool" | "orderbook" }[]
  >`
    select address, market_type
    from markets
    where (question is null or question = '')
       or collateral = '0x0000000000000000000000000000000000000000'
    limit 500
  `;

  for (const m of toEnrich) {
    const addr = m.address as `0x${string}`;
    try {
      if (m.market_type === "orderbook") {
        const collateral = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: orderbookMarketReadAbi,
              functionName: "collateral",
            }),
          "orderbookMarket.collateral",
        );
        const oracle = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: orderbookMarketReadAbi,
              functionName: "oracle",
            }),
          "orderbookMarket.oracle",
        );
        const tradingEndsAt = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: orderbookMarketReadAbi,
              functionName: "tradingEndsAt",
            }),
          "orderbookMarket.tradingEndsAt",
        );
        const claimDelayAfterResolve = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: orderbookMarketReadAbi,
              functionName: "claimDelayAfterResolve",
            }),
          "orderbookMarket.claimDelayAfterResolve",
        );
        const question = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: orderbookMarketReadAbi,
              functionName: "question",
            }),
          "orderbookMarket.question",
        );

        await opts.db`
          update markets
          set
            collateral = ${String(collateral)},
            oracle = ${String(oracle)},
            trading_ends_at = ${BigInt(tradingEndsAt as bigint)},
            claim_delay_after_resolve = ${BigInt(claimDelayAfterResolve as bigint)},
            question = ${String(question)}
          where lower(address) = ${String(addr).toLowerCase()}
        `;
      } else {
        const collateral = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: poolMarketReadAbi,
              functionName: "collateral",
            }),
          "poolMarket.collateral",
        );
        const oracle = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: poolMarketReadAbi,
              functionName: "oracle",
            }),
          "poolMarket.oracle",
        );
        const tradingEndsAt = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: poolMarketReadAbi,
              functionName: "tradingEndsAt",
            }),
          "poolMarket.tradingEndsAt",
        );
        const claimDelayAfterResolve = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: poolMarketReadAbi,
              functionName: "claimDelayAfterResolve",
            }),
          "poolMarket.claimDelayAfterResolve",
        );
        const question = await withRetry(
          () =>
            client.readContract({
              address: addr,
              abi: poolMarketReadAbi,
              functionName: "question",
            }),
          "poolMarket.question",
        );

        await opts.db`
          update markets
          set
            collateral = ${String(collateral)},
            oracle = ${String(oracle)},
            trading_ends_at = ${BigInt(tradingEndsAt as bigint)},
            claim_delay_after_resolve = ${BigInt(claimDelayAfterResolve as bigint)},
            question = ${String(question)}
          where lower(address) = ${String(addr).toLowerCase()}
        `;
      }
    } catch {
      // ignore single-market failures (RPC hiccups / nonstandard contracts)
    }
  }

  const markets = await opts.db<{ address: string; market_type: string }[]>`
    select address, market_type from markets
  `;
  const poolAddrs = markets.filter((m) => m.market_type === "pool").map((m) => m.address as `0x${string}`);
  const obAddrs = markets
    .filter((m) => m.market_type === "orderbook")
    .map((m) => m.address as `0x${string}`);
  if (poolAddrs.length === 0 && obAddrs.length === 0) return { head, markets: 0, events: 0 };

  // 2) Index pool market events for all pool markets at once.
  const evKey = `markets:pool:events:lastBlock`;
  const lastEv = await getCursor(opts.db, evKey);
  const fromEv = lastEv
    ? BigInt(lastEv) + 1n
    : head > INITIAL_LOOKBACK
      ? head - INITIAL_LOOKBACK
      : 0n;

  let inserted = 0;
  if (poolAddrs.length > 0 && fromEv <= head) {
    // Keep ticks fast: index at most one CHUNK window per tick.
    const toEv = fromEv + CHUNK - 1n < head ? fromEv + CHUNK - 1n : head;
    for await (const r of chunkRanges(fromEv, toEv)) {
      const yes = await withRetry(
        () =>
          client.getLogs({
            address: poolAddrs,
            event: betYes,
            fromBlock: r.fromBlock,
            toBlock: r.toBlock,
          }),
        "getLogs(BetYes)",
      );
      const no = await withRetry(
        () =>
          client.getLogs({
            address: poolAddrs,
            event: betNo,
            fromBlock: r.fromBlock,
            toBlock: r.toBlock,
          }),
        "getLogs(BetNo)",
      );
      const claim = await withRetry(
        () =>
          client.getLogs({
            address: poolAddrs,
            event: claimed,
            fromBlock: r.fromBlock,
            toBlock: r.toBlock,
          }),
        "getLogs(Claimed)",
      );
      const res = await withRetry(
        () =>
          client.getLogs({
            address: poolAddrs,
            event: resolved,
            fromBlock: r.fromBlock,
            toBlock: r.toBlock,
          }),
        "getLogs(Resolved)",
      );

      const batch = [
        ...yes.map((l) => ({
          market: (l.address ?? "") as string,
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash ?? "",
          logIndex: l.logIndex ?? 0,
          kind: "BetYes",
          user: (l as { args?: { user?: string } }).args?.user ?? null,
          amount: (l as { args?: { amount?: bigint } }).args?.amount ?? null,
          outcome: null,
          claimsOpenAt: null,
        })),
        ...no.map((l) => ({
          market: (l.address ?? "") as string,
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash ?? "",
          logIndex: l.logIndex ?? 0,
          kind: "BetNo",
          user: (l as { args?: { user?: string } }).args?.user ?? null,
          amount: (l as { args?: { amount?: bigint } }).args?.amount ?? null,
          outcome: null,
          claimsOpenAt: null,
        })),
        ...claim.map((l) => ({
          market: (l.address ?? "") as string,
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash ?? "",
          logIndex: l.logIndex ?? 0,
          kind: "Claimed",
          user: (l as { args?: { user?: string } }).args?.user ?? null,
          amount: (l as { args?: { payout?: bigint } }).args?.payout ?? null,
          outcome: null,
          claimsOpenAt: null,
        })),
        ...res.map((l) => ({
          market: (l.address ?? "") as string,
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash ?? "",
          logIndex: l.logIndex ?? 0,
          kind: "Resolved",
          user: null,
          amount: null,
          outcome:
            (l as { args?: { outcome?: bigint | number } }).args?.outcome != null
              ? Number((l as { args?: { outcome?: bigint | number } }).args!.outcome)
              : null,
          claimsOpenAt:
            (l as { args?: { claimsOpenAt?: bigint | number } }).args?.claimsOpenAt != null
              ? BigInt(
                  (l as { args?: { claimsOpenAt?: bigint | number } }).args!.claimsOpenAt as any,
                )
              : null,
        })),
      ];

      if (batch.length) {
        for (const e of batch) {
          if (!e.tx) continue;
          await opts.db`
            insert into market_events (
              market, block_number, tx_hash, log_index, kind, user_addr, amount, outcome, claims_open_at
            ) values (
              ${e.market},
              ${e.block},
              ${e.tx},
              ${e.logIndex},
              ${e.kind},
              ${e.user},
              ${e.amount != null ? String(e.amount) : null},
              ${e.outcome},
              ${e.claimsOpenAt != null ? e.claimsOpenAt : null}
            )
            on conflict (tx_hash, log_index) do nothing
          `;
          inserted += 1;
        }
      }

      await setCursor(opts.db, evKey, r.toBlock.toString());
    }
  }

  // 3) Index orderbook events and maintain orderbook_orders table.
  if (obAddrs.length > 0) {
    const obKey = `markets:orderbook:events:lastBlock`;
    const last = await getCursor(opts.db, obKey);
    const from = last
      ? BigInt(last) + 1n
      : head > INITIAL_LOOKBACK
        ? head - INITIAL_LOOKBACK
        : 0n;

    const orderPlaced = parseAbiItem(
      "event OrderPlaced(uint256 indexed id, address indexed maker, uint8 side, uint8 price, uint256 size)",
    );
    const orderCancelled = parseAbiItem(
      "event OrderCancelled(uint256 indexed id, address indexed maker, uint256 sizeRemaining)",
    );
    const trade = parseAbiItem(
      "event Trade(uint256 indexed makerOrderId, address indexed maker, address indexed taker, uint8 makerSide, uint8 price, uint256 size)",
    );

    if (from <= head) {
      const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
      for await (const r of chunkRanges(from, to)) {
        const placed = await withRetry(
          () =>
            client.getLogs({
              address: obAddrs,
              event: orderPlaced,
              fromBlock: r.fromBlock,
              toBlock: r.toBlock,
            }),
          "getLogs(OrderPlaced)",
        );
        const cancelled = await withRetry(
          () =>
            client.getLogs({
              address: obAddrs,
              event: orderCancelled,
              fromBlock: r.fromBlock,
              toBlock: r.toBlock,
            }),
          "getLogs(OrderCancelled)",
        );
        const trades = await withRetry(
          () =>
            client.getLogs({
              address: obAddrs,
              event: trade,
              fromBlock: r.fromBlock,
              toBlock: r.toBlock,
            }),
          "getLogs(Trade)",
        );
        const res2 = await withRetry(
          () =>
            client.getLogs({
              address: obAddrs,
              event: resolved,
              fromBlock: r.fromBlock,
              toBlock: r.toBlock,
            }),
          "getLogs(Resolved/OB)",
        );
        const claim2 = await withRetry(
          () =>
            client.getLogs({
              address: obAddrs,
              event: claimed,
              fromBlock: r.fromBlock,
              toBlock: r.toBlock,
            }),
          "getLogs(Claimed/OB)",
        );

        for (const l of placed) {
          const market = String(l.address ?? "").toLowerCase();
          const oid = String((l as any).args?.id ?? "0");
          const maker = String((l as any).args?.maker ?? "");
          const side = Number((l as any).args?.side ?? 0);
          const price = Number((l as any).args?.price ?? 0);
          const size = String((l as any).args?.size ?? "0");

          await opts.db`
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'OrderPlaced', ${maker}, ${size})
            on conflict (tx_hash, log_index) do nothing
          `;

          await opts.db`
            insert into orderbook_orders (market, order_id, maker, side, price, size_remaining, created_block, created_tx)
            values (${market}, ${oid}, ${maker}, ${side}, ${price}, ${size}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""})
            on conflict (market, order_id) do nothing
          `;
          inserted += 1;
        }

        for (const l of cancelled) {
          const market = String(l.address ?? "").toLowerCase();
          const oid = String((l as any).args?.id ?? "0");
          const maker = String((l as any).args?.maker ?? "");
          const rem = String((l as any).args?.sizeRemaining ?? "0");
          await opts.db`
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'OrderCancelled', ${maker}, ${rem})
            on conflict (tx_hash, log_index) do nothing
          `;
          await opts.db`
            update orderbook_orders set size_remaining = ${rem}
            where market = ${market} and order_id = ${oid}
          `;
          inserted += 1;
        }

        for (const l of trades) {
          const market = String(l.address ?? "").toLowerCase();
          const oid = String((l as any).args?.makerOrderId ?? "0");
          const maker = String((l as any).args?.maker ?? "");
          const taker = String((l as any).args?.taker ?? "");
          const size = String((l as any).args?.size ?? "0");
          await opts.db`
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'Trade', ${taker}, ${size})
            on conflict (tx_hash, log_index) do nothing
          `;
          // Decrement remaining size.
          await opts.db`
            update orderbook_orders
            set size_remaining = greatest(0, size_remaining - ${size})
            where market = ${market} and order_id = ${oid}
          `;
          inserted += 1;
        }

        for (const l of res2) {
          const market = String(l.address ?? "").toLowerCase();
          const o = (l as any).args?.outcome;
          const co = (l as any).args?.claimsOpenAt;
          await opts.db`
            insert into market_events (market, block_number, tx_hash, log_index, kind, outcome, claims_open_at)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'Resolved', ${o != null ? Number(o) : null}, ${co != null ? BigInt(co) : null})
            on conflict (tx_hash, log_index) do nothing
          `;
          inserted += 1;
        }
        for (const l of claim2) {
          const market = String(l.address ?? "").toLowerCase();
          const user = (l as any).args?.user;
          const payout = (l as any).args?.payout;
          await opts.db`
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'Claimed', ${user ?? null}, ${payout != null ? String(payout) : null})
            on conflict (tx_hash, log_index) do nothing
          `;
          inserted += 1;
        }

        await setCursor(opts.db, obKey, r.toBlock.toString());
      }
    }
  }

  return { head, markets: poolAddrs.length + obAddrs.length, events: inserted };
}

