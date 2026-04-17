"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import { erc20Abi, orderbookMarketAbi } from "@/lib/abi";
import {
  hasIndexer,
  indexerFetchOrderbookLevels,
  indexerFetchOrderbookOrders,
  type IndexerLevel,
  type IndexerOrder,
} from "@/lib/indexerClient";
import { riseExplorerTxUrl } from "@/lib/riseExplorer";

type Props = {
  market: `0x${string}`;
  question: string;
  oracle: `0x${string}` | undefined;
  tradingEndsAt: bigint | undefined;
  claimsOpenAt: bigint | undefined;
  outcomeNum: number;
  isOracle: boolean;
};

type SideId = 0 | 1 | 2 | 3; // BuyYes, SellYes, BuyNo, SellNo

function requiredWei(side: SideId, price: number, size: bigint): bigint {
  const p = BigInt(price);
  if (side === 0 || side === 2) return p * size; // buy
  return (100n - p) * size; // sell
}

function requiredDeposit(side: SideId, price: number, size: bigint, shareUnit: bigint): bigint {
  const buyPerShare = (shareUnit * BigInt(price)) / 100n;
  const sellPerShare = shareUnit - buyPerShare;
  const per = side === 0 || side === 2 ? buyPerShare : sellPerShare;
  return per * size;
}

function opposite(side: SideId): SideId {
  if (side === 0) return 1;
  if (side === 1) return 0;
  if (side === 2) return 3;
  return 2;
}

function sideLabel(side: SideId) {
  if (side === 0) return "Buy YES";
  if (side === 1) return "Sell YES";
  if (side === 2) return "Buy NO";
  return "Sell NO";
}

export function OrderBookTradePanel(p: Props) {
  const { address, isConnected } = useAccount();
  const [levels, setLevels] = useState<IndexerLevel[]>([]);
  const [orders, setOrders] = useState<IndexerOrder[]>([]);
  const [myOrders, setMyOrders] = useState<IndexerOrder[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [err, setErr] = useState<string | null>(null);

  const [side, setSide] = useState<SideId>(0);
  const [price, setPrice] = useState("60");
  const [size, setSize] = useState("1");

  const [takeId, setTakeId] = useState<string>("");
  const [takeSize, setTakeSize] = useState("1");

  const { data: collateralAddr } = useReadContract({
    chainId: 11155931,
    address: p.market,
    abi: orderbookMarketAbi,
    functionName: "collateral",
  });
  const { data: shareUnit } = useReadContract({
    chainId: 11155931,
    address: p.market,
    abi: orderbookMarketAbi,
    functionName: "shareUnit",
  });

  const isEth = !collateralAddr || collateralAddr === zeroAddress;
  const unit = typeof shareUnit === "bigint" ? shareUnit : 0n;

  const { data: allowance } = useReadContract({
    chainId: 11155931,
    address: !isEth ? (collateralAddr as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && !isEth ? [address, p.market] : undefined,
    query: { enabled: !!address && !isEth && !!collateralAddr },
  });

  const { data: yesBal } = useReadContract({
    chainId: 11155931,
    address: p.market,
    abi: orderbookMarketAbi,
    functionName: "yesShares",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: noBal } = useReadContract({
    chainId: 11155931,
    address: p.market,
    abi: orderbookMarketAbi,
    functionName: "noShares",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: claimed } = useReadContract({
    chainId: 11155931,
    address: p.market,
    abi: orderbookMarketAbi,
    functionName: "claimed",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (confirmed) reset();
  }, [confirmed, reset]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasIndexer()) {
        setLevels([]);
        setOrders([]);
        setMyOrders([]);
        setStatus("ok");
        return;
      }
      setStatus("loading");
      setErr(null);
      try {
        const [lv, od, mine] = await Promise.all([
          indexerFetchOrderbookLevels(p.market),
          indexerFetchOrderbookOrders(p.market, { limit: 200 }),
          address ? indexerFetchOrderbookOrders(p.market, { limit: 200, maker: address }) : null,
        ]);
        if (cancelled) return;
        setLevels(lv ?? []);
        setOrders(od ?? []);
        setMyOrders(mine ?? []);
        setStatus("ok");
      } catch (e) {
        if (!cancelled) {
          setStatus("err");
          setErr(e instanceof Error ? e.message : "Failed to load orderbook");
        }
      }
    }
    void load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [p.market, address]);

  const parsed = useMemo(() => {
    const pr = Number(price);
    const sz = BigInt(Math.max(0, Number(size)));
    const ok = Number.isFinite(pr) && pr > 0 && pr < 100 && sz > 0n;
    if (!ok || unit === 0n) return { ok: false, pr, sz, wei: 0n };
    return { ok: true, pr, sz, wei: requiredDeposit(side, pr, sz, unit) };
  }, [price, size, side, unit]);

  const needsApproval = useMemo(() => {
    if (isEth) return false;
    if (!isConnected || !address) return true;
    if (!parsed.ok) return true;
    return (allowance ?? 0n) < parsed.wei;
  }, [isEth, isConnected, address, parsed.ok, parsed.wei, allowance]);

  const takeParsed = useMemo(() => {
    const id = takeId.trim();
    const oid = id ? BigInt(id) : null;
    const sz = BigInt(Math.max(0, Number(takeSize)));
    const ok = oid != null && sz > 0n;
    return { ok, oid, sz };
  }, [takeId, takeSize]);

  const openOrdersForUi = useMemo(() => {
    return orders.slice(0, 60);
  }, [orders]);

  const myOrdersForUi = useMemo(() => myOrders.slice(0, 50), [myOrders]);

  const nowSec = Math.floor(Date.now() / 1000);
  const tradingOpen = p.tradingEndsAt != null ? nowSec < Number(p.tradingEndsAt) : true;
  const claimsReady =
    p.claimsOpenAt != null && p.outcomeNum !== 0 && nowSec >= Number(p.claimsOpenAt);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] shadow-2xl shadow-black/50 xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100vh-6rem)]">
      <div className="shrink-0 border-b border-[var(--pm-border)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
          Order book market
        </p>
        <p className="mt-1 line-clamp-2 text-[16px] font-semibold text-white">{p.question}</p>
        <p className="mt-2 text-[11px] text-[#8b949e]">
          Collateral:{" "}
          <span className="font-mono text-[#c9d1d9]">
            {isEth ? "ETH" : String(collateralAddr ?? "")}
          </span>
          {" · "}
          Each share locks{" "}
          <span className="font-mono text-[#c9d1d9]">
            {unit > 0n ? (isEth ? formatUnits(unit, 18) : `${unit.toString()} units`) : "…"}
          </span>
          {isEth ? " ETH" : " token"} (price in cents).
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-px bg-[var(--pm-border)] sm:grid-cols-2">
          <div className="bg-[var(--pm-surface-2)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6e7681]">
              Your shares
            </p>
            <p className="mt-1 text-[13px] text-[#e6edf3]">
              YES {String(yesBal ?? 0n)} · NO {String(noBal ?? 0n)}
            </p>
          </div>
          <div className="bg-[var(--pm-surface-2)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6e7681]">
              Trading
            </p>
            <p className="mt-1 text-[13px] text-[#e6edf3]">{tradingOpen ? "Live" : "Closed"}</p>
          </div>
        </div>

        <div className="border-t border-[var(--pm-border)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
            Place limit order
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
              Side
              <select
                value={String(side)}
                onChange={(e) => setSide(Number(e.target.value) as SideId)}
                className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-3 py-2 text-[13px] text-white outline-none"
              >
                <option value="0">Buy YES</option>
                <option value="1">Sell YES</option>
                <option value="2">Buy NO</option>
                <option value="3">Sell NO</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
              Price (1-99¢)
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-3 py-2 text-[13px] text-white outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
              Size (shares)
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-3 py-2 text-[13px] text-white outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[#6e7681]">
              Deposit:{" "}
              <span className="font-mono text-[#c9d1d9]">{parsed.ok ? `${parsed.wei} wei` : "—"}</span>
            </p>
            <button
              type="button"
              disabled={
                !isConnected ||
                !tradingOpen ||
                !parsed.ok ||
                (!isEth && needsApproval) ||
                isPending ||
                confirming
              }
              onClick={() => {
                if (!parsed.ok) return;
                writeContract({
                  chainId: 11155931,
                  address: p.market,
                  abi: orderbookMarketAbi,
                  functionName: "placeLimit",
                  args: [side, parsed.pr, parsed.sz],
                  value: isEth ? parsed.wei : 0n,
                });
              }}
              className="rounded-xl bg-[var(--pm-yes)] px-4 py-2.5 text-[13px] font-semibold text-[#0b0e11] hover:brightness-95 disabled:opacity-40"
            >
              Place
            </button>
            {!isEth ? (
              <button
                type="button"
                disabled={!isConnected || !needsApproval || isPending || confirming}
                onClick={() => {
                  if (!collateralAddr) return;
                  writeContract({
                    chainId: 11155931,
                    address: collateralAddr as `0x${string}`,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [p.market, 2n ** 256n - 1n],
                  });
                }}
                className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--pm-surface-2)] disabled:opacity-40"
              >
                Approve token
              </button>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[var(--pm-border)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
            Take order by id
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
              Maker order id
              <input
                value={takeId}
                onChange={(e) => setTakeId(e.target.value)}
                className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-3 py-2 text-[13px] text-white outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
              Size
              <input
                value={takeSize}
                onChange={(e) => setTakeSize(e.target.value)}
                className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-3 py-2 text-[13px] text-white outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[#6e7681]">
              Deposit is computed from order side/price (use list below).
            </p>
            <button
              type="button"
              disabled={!isConnected || !tradingOpen || !takeParsed.ok || isPending || confirming}
              onClick={() => {
                if (!takeParsed.ok || takeParsed.oid == null) return;
                const match = orders.find((o) => o.order_id === String(takeParsed.oid));
                if (!match) {
                  setErr("Order id not in indexer list yet. Wait for indexing.");
                  return;
                }
                const makerSide = match.side as SideId;
                const pr = match.price;
                const val =
                  unit > 0n ? requiredDeposit(opposite(makerSide), pr, takeParsed.sz, unit) : 0n;
                writeContract({
                  chainId: 11155931,
                  address: p.market,
                  abi: orderbookMarketAbi,
                  functionName: "take",
                  args: [takeParsed.oid, takeParsed.sz],
                  value: isEth ? val : 0n,
                });
              }}
              className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--pm-surface-2)] disabled:opacity-40"
            >
              Take
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--pm-border)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
            Order book (from indexer)
          </p>
          {!hasIndexer() ? (
            <div className="mt-3 rounded-xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-4 py-4 text-[12px] text-[#8b949e]">
              Set <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_INDEXER_URL</code> to enable
              order book depth.
            </div>
          ) : status === "err" ? (
            <div className="mt-3 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-4 py-4 text-[12px] text-[#ff6b6b]">
              {err ?? "Indexer error"}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 p-3">
                <p className="text-[11px] font-semibold text-white">Levels</p>
                <div className="mt-2 max-h-56 overflow-auto text-[12px] text-[#c9d1d9]">
                  {levels.length === 0 ? (
                    <p className="text-[#8b949e]">No open levels.</p>
                  ) : (
                    levels.map((l, i) => (
                      <div key={`${l.side}-${l.price}-${i}`} className="flex justify-between py-1">
                        <span className="text-[#8b949e]">{sideLabel(l.side as SideId)}</span>
                        <span className="font-mono">
                          {l.price}¢ · {l.size}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 p-3">
                <p className="text-[11px] font-semibold text-white">Open orders</p>
                <div className="mt-2 max-h-56 overflow-auto text-[12px] text-[#c9d1d9]">
                  {openOrdersForUi.length === 0 ? (
                    <p className="text-[#8b949e]">No open orders yet.</p>
                  ) : (
                    openOrdersForUi.map((o) => (
                      <div
                        key={`${o.order_id}-${o.created_tx}`}
                        className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px] text-[#8b949e]">
                            id {o.order_id} · {sideLabel(o.side as SideId)}
                          </p>
                          <p className="text-[12px]">
                            {o.price}¢ · rem {o.size_remaining}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border border-[var(--pm-border)] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-white/[0.05]"
                          onClick={() => {
                            setTakeId(o.order_id);
                            setTakeSize("1");
                          }}
                        >
                          Take…
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--pm-border)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
            Your open orders
          </p>
          {!isConnected || !address ? (
            <p className="mt-2 text-[12px] text-[#8b949e]">Connect a wallet to see and cancel your orders.</p>
          ) : !hasIndexer() ? (
            <p className="mt-2 text-[12px] text-[#8b949e]">
              Set <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_INDEXER_URL</code> to list open
              orders.
            </p>
          ) : myOrdersForUi.length === 0 ? (
            <p className="mt-2 text-[12px] text-[#8b949e]">No open orders.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {myOrdersForUi.map((o) => (
                <div
                  key={`${o.order_id}-${o.created_tx}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-bg)]/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-[#8b949e]">
                      id {o.order_id} · {sideLabel(o.side as SideId)}
                    </p>
                    <p className="text-[12px] text-[#c9d1d9]">
                      {o.price}¢ · rem {o.size_remaining}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isPending || confirming || !tradingOpen}
                    className="rounded-lg border border-[var(--pm-border)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.05] disabled:opacity-40"
                    onClick={() =>
                      writeContract({
                        chainId: 11155931,
                        address: p.market,
                        abi: orderbookMarketAbi,
                        functionName: "cancel",
                        args: [BigInt(o.order_id)],
                      })
                    }
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {p.isOracle ? (
          <div className="border-t border-amber-500/25 bg-amber-500/[0.07] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
              Oracle
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
                disabled={tradingOpen || isPending || confirming}
                onClick={() =>
                  writeContract({
                    chainId: 11155931,
                    address: p.market,
                    abi: orderbookMarketAbi,
                    functionName: "resolve",
                    args: [true],
                  })
                }
              >
                Resolve YES
              </button>
              <button
                type="button"
                className="rounded-xl border border-amber-500/50 px-4 py-2.5 text-[13px] font-medium text-amber-100 hover:bg-amber-500/10 disabled:opacity-40"
                disabled={tradingOpen || isPending || confirming}
                onClick={() =>
                  writeContract({
                    chainId: 11155931,
                    address: p.market,
                    abi: orderbookMarketAbi,
                    functionName: "resolve",
                    args: [false],
                  })
                }
              >
                Resolve NO
              </button>
            </div>
            <p className="mt-2 text-[11px] text-amber-200/70">Available after trading ends.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--pm-border)] px-4 py-4">
          <button
            type="button"
            disabled={!isConnected || !claimsReady || Boolean(claimed) || isPending || confirming}
            onClick={() =>
              writeContract({
                chainId: 11155931,
                address: p.market,
                abi: orderbookMarketAbi,
                functionName: "claim",
              })
            }
            className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-semibold text-[#09090b] hover:bg-[#e4e4e7] disabled:opacity-40"
          >
            Claim
          </button>
          {hash ? (
            <a
              className="text-[11px] text-[var(--pm-yes)] hover:underline"
              href={riseExplorerTxUrl(hash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          ) : null}
          {error ? (
            <p className="w-full text-[11px] text-[var(--pm-no)]">{error.message}</p>
          ) : null}
          {err ? <p className="w-full text-[11px] text-[var(--pm-no)]">{err}</p> : null}
          {isPending || confirming ? (
            <p className="w-full text-[11px] text-[#8b949e]">
              {isPending ? "Confirm in wallet…" : "Confirming…"}
            </p>
          ) : null}
          {confirmed ? <p className="w-full text-[11px] text-[var(--pm-yes)]">Confirmed.</p> : null}
        </div>
      </div>
    </section>
  );
}

