import { createPublicClient, http, parseAbiItem } from "viem";
import { getCursor, setCursor } from "./db.js";
// RISE public RPC enforces a max `eth_getLogs` block range (often 5000).
// Keep this safely under that limit.
const CHUNK = 4000n;
const INITIAL_LOOKBACK = 200000n;
const marketCreated = parseAbiItem("event MarketCreated(uint256 indexed id, address indexed market, address indexed collateral, address oracle, uint64 tradingEndsAt, uint64 claimDelayAfterResolve, string question)");
const betYes = parseAbiItem("event BetYes(address indexed user, uint256 amount)");
const betNo = parseAbiItem("event BetNo(address indexed user, uint256 amount)");
const claimed = parseAbiItem("event Claimed(address indexed user, uint256 payout)");
const resolved = parseAbiItem("event Resolved(uint8 outcome, uint64 claimsOpenAt)");
async function* chunkRanges(fromBlock, toBlock) {
    let start = fromBlock;
    while (start <= toBlock) {
        const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n;
        yield { fromBlock: start, toBlock: end };
        start = end + 1n;
    }
}
export async function indexOnce(opts) {
    const client = createPublicClient({
        transport: http(opts.rpcUrl),
    });
    const head = await client.getBlockNumber();
    // 1) Discover pool markets from MarketFactory logs.
    const mcKey = `factory:${opts.factory}:MarketCreated:lastBlock`;
    const lastMc = await getCursor(opts.db, mcKey);
    const fromMc = lastMc
        ? BigInt(lastMc) + 1n
        : head > INITIAL_LOOKBACK
            ? head - INITIAL_LOOKBACK
            : 0n;
    if (fromMc <= head) {
        for await (const r of chunkRanges(fromMc, head)) {
            const logs = await client.getLogs({
                address: opts.factory,
                event: marketCreated,
                fromBlock: r.fromBlock,
                toBlock: r.toBlock,
            });
            for (const l of logs) {
                const market = l.args.market;
                if (!market)
                    continue;
                await opts.db `
          insert into markets (
            address, market_type, created_block, created_tx, factory_id, collateral, oracle, trading_ends_at, claim_delay_after_resolve, question
          ) values (
            ${market},
            'pool',
            ${l.blockNumber ?? 0n},
            ${l.transactionHash ?? ""},
            ${String(l.args.id ?? 0n)},
            ${String(l.args.collateral ?? "0x0000000000000000000000000000000000000000")},
            ${String(l.args.oracle ?? "0x0000000000000000000000000000000000000000")},
            ${BigInt(l.args.tradingEndsAt ?? 0n)},
            ${BigInt(l.args.claimDelayAfterResolve ?? 0n)},
            ${String(l.args.question ?? "")}
          )
          on conflict (address) do nothing
        `;
            }
            await setCursor(opts.db, mcKey, r.toBlock.toString());
        }
    }
    // 1b) Discover orderbook markets (optional).
    if (opts.orderbookFactory) {
        const obCreated = parseAbiItem("event OrderBookMarketCreated(uint256 indexed id, address indexed market, address indexed collateral, uint8 collateralDecimals, address oracle, uint64 tradingEndsAt, uint64 claimDelayAfterResolve, string question)");
        const key = `factory:${opts.orderbookFactory}:OrderBookMarketCreated:lastBlock`;
        const last = await getCursor(opts.db, key);
        const from = last
            ? BigInt(last) + 1n
            : head > INITIAL_LOOKBACK
                ? head - INITIAL_LOOKBACK
                : 0n;
        if (from <= head) {
            for await (const r of chunkRanges(from, head)) {
                const logs = await client.getLogs({
                    address: opts.orderbookFactory,
                    event: obCreated,
                    fromBlock: r.fromBlock,
                    toBlock: r.toBlock,
                });
                for (const l of logs) {
                    const market = l.args.market ?? undefined;
                    if (!market)
                        continue;
                    await opts.db `
            insert into markets (
              address, market_type, created_block, created_tx, factory_id, collateral, oracle, trading_ends_at, claim_delay_after_resolve, question
            ) values (
              ${market},
              'orderbook',
              ${l.blockNumber ?? 0n},
              ${l.transactionHash ?? ""},
              ${String(l.args.id ?? 0n)},
              ${String(l.args?.collateral ?? "0x0000000000000000000000000000000000000000")},
              ${String(l.args.oracle ?? "0x0000000000000000000000000000000000000000")},
              ${BigInt(l.args.tradingEndsAt ?? 0n)},
              ${BigInt(l.args.claimDelayAfterResolve ?? 0n)},
              ${String(l.args.question ?? "")}
            )
            on conflict (address) do nothing
          `;
                }
                await setCursor(opts.db, key, r.toBlock.toString());
            }
        }
    }
    const markets = await opts.db `
    select address, market_type from markets
  `;
    const poolAddrs = markets.filter((m) => m.market_type === "pool").map((m) => m.address);
    const obAddrs = markets
        .filter((m) => m.market_type === "orderbook")
        .map((m) => m.address);
    if (poolAddrs.length === 0 && obAddrs.length === 0)
        return { head, markets: 0, events: 0 };
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
        for await (const r of chunkRanges(fromEv, head)) {
            const [yes, no, claim, res] = await Promise.all([
                client.getLogs({
                    address: poolAddrs,
                    event: betYes,
                    fromBlock: r.fromBlock,
                    toBlock: r.toBlock,
                }),
                client.getLogs({
                    address: poolAddrs,
                    event: betNo,
                    fromBlock: r.fromBlock,
                    toBlock: r.toBlock,
                }),
                client.getLogs({
                    address: poolAddrs,
                    event: claimed,
                    fromBlock: r.fromBlock,
                    toBlock: r.toBlock,
                }),
                client.getLogs({
                    address: poolAddrs,
                    event: resolved,
                    fromBlock: r.fromBlock,
                    toBlock: r.toBlock,
                }),
            ]);
            const batch = [
                ...yes.map((l) => ({
                    market: (l.address ?? ""),
                    block: l.blockNumber ?? 0n,
                    tx: l.transactionHash ?? "",
                    logIndex: l.logIndex ?? 0,
                    kind: "BetYes",
                    user: l.args?.user ?? null,
                    amount: l.args?.amount ?? null,
                    outcome: null,
                    claimsOpenAt: null,
                })),
                ...no.map((l) => ({
                    market: (l.address ?? ""),
                    block: l.blockNumber ?? 0n,
                    tx: l.transactionHash ?? "",
                    logIndex: l.logIndex ?? 0,
                    kind: "BetNo",
                    user: l.args?.user ?? null,
                    amount: l.args?.amount ?? null,
                    outcome: null,
                    claimsOpenAt: null,
                })),
                ...claim.map((l) => ({
                    market: (l.address ?? ""),
                    block: l.blockNumber ?? 0n,
                    tx: l.transactionHash ?? "",
                    logIndex: l.logIndex ?? 0,
                    kind: "Claimed",
                    user: l.args?.user ?? null,
                    amount: l.args?.payout ?? null,
                    outcome: null,
                    claimsOpenAt: null,
                })),
                ...res.map((l) => ({
                    market: (l.address ?? ""),
                    block: l.blockNumber ?? 0n,
                    tx: l.transactionHash ?? "",
                    logIndex: l.logIndex ?? 0,
                    kind: "Resolved",
                    user: null,
                    amount: null,
                    outcome: l.args?.outcome != null
                        ? Number(l.args.outcome)
                        : null,
                    claimsOpenAt: l.args?.claimsOpenAt != null
                        ? BigInt(l.args.claimsOpenAt)
                        : null,
                })),
            ];
            if (batch.length) {
                for (const e of batch) {
                    if (!e.tx)
                        continue;
                    await opts.db `
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
        const orderPlaced = parseAbiItem("event OrderPlaced(uint256 indexed id, address indexed maker, uint8 side, uint8 price, uint256 size)");
        const orderCancelled = parseAbiItem("event OrderCancelled(uint256 indexed id, address indexed maker, uint256 sizeRemaining)");
        const trade = parseAbiItem("event Trade(uint256 indexed makerOrderId, address indexed maker, address indexed taker, uint8 makerSide, uint8 price, uint256 size)");
        if (from <= head) {
            for await (const r of chunkRanges(from, head)) {
                const [placed, cancelled, trades, res2, claim2] = await Promise.all([
                    client.getLogs({ address: obAddrs, event: orderPlaced, fromBlock: r.fromBlock, toBlock: r.toBlock }),
                    client.getLogs({ address: obAddrs, event: orderCancelled, fromBlock: r.fromBlock, toBlock: r.toBlock }),
                    client.getLogs({ address: obAddrs, event: trade, fromBlock: r.fromBlock, toBlock: r.toBlock }),
                    client.getLogs({ address: obAddrs, event: resolved, fromBlock: r.fromBlock, toBlock: r.toBlock }),
                    client.getLogs({ address: obAddrs, event: claimed, fromBlock: r.fromBlock, toBlock: r.toBlock }),
                ]);
                for (const l of placed) {
                    const market = String(l.address ?? "").toLowerCase();
                    const oid = String(l.args?.id ?? "0");
                    const maker = String(l.args?.maker ?? "");
                    const side = Number(l.args?.side ?? 0);
                    const price = Number(l.args?.price ?? 0);
                    const size = String(l.args?.size ?? "0");
                    await opts.db `
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'OrderPlaced', ${maker}, ${size})
            on conflict (tx_hash, log_index) do nothing
          `;
                    await opts.db `
            insert into orderbook_orders (market, order_id, maker, side, price, size_remaining, created_block, created_tx)
            values (${market}, ${oid}, ${maker}, ${side}, ${price}, ${size}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""})
            on conflict (market, order_id) do nothing
          `;
                    inserted += 1;
                }
                for (const l of cancelled) {
                    const market = String(l.address ?? "").toLowerCase();
                    const oid = String(l.args?.id ?? "0");
                    const maker = String(l.args?.maker ?? "");
                    const rem = String(l.args?.sizeRemaining ?? "0");
                    await opts.db `
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'OrderCancelled', ${maker}, ${rem})
            on conflict (tx_hash, log_index) do nothing
          `;
                    await opts.db `
            update orderbook_orders set size_remaining = ${rem}
            where market = ${market} and order_id = ${oid}
          `;
                    inserted += 1;
                }
                for (const l of trades) {
                    const market = String(l.address ?? "").toLowerCase();
                    const oid = String(l.args?.makerOrderId ?? "0");
                    const maker = String(l.args?.maker ?? "");
                    const taker = String(l.args?.taker ?? "");
                    const size = String(l.args?.size ?? "0");
                    await opts.db `
            insert into market_events (market, block_number, tx_hash, log_index, kind, user_addr, amount)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'Trade', ${taker}, ${size})
            on conflict (tx_hash, log_index) do nothing
          `;
                    // Decrement remaining size.
                    await opts.db `
            update orderbook_orders
            set size_remaining = greatest(0, size_remaining - ${size})
            where market = ${market} and order_id = ${oid}
          `;
                    inserted += 1;
                }
                for (const l of res2) {
                    const market = String(l.address ?? "").toLowerCase();
                    const o = l.args?.outcome;
                    const co = l.args?.claimsOpenAt;
                    await opts.db `
            insert into market_events (market, block_number, tx_hash, log_index, kind, outcome, claims_open_at)
            values (${market}, ${l.blockNumber ?? 0n}, ${l.transactionHash ?? ""}, ${l.logIndex ?? 0}, 'Resolved', ${o != null ? Number(o) : null}, ${co != null ? BigInt(co) : null})
            on conflict (tx_hash, log_index) do nothing
          `;
                    inserted += 1;
                }
                for (const l of claim2) {
                    const market = String(l.address ?? "").toLowerCase();
                    const user = l.args?.user;
                    const payout = l.args?.payout;
                    await opts.db `
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
