"use client";

import {
  useAccount,
  useBlockNumber,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  zeroAddress,
} from "viem";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  factoryAbi,
  marketAbi,
  erc20Abi,
  orderbookFactoryAbi,
  orderbookMarketAbi,
} from "@/lib/abi";
import {
  filterMarketRows,
  PM_CATEGORIES,
  poolYesPercent,
  sortMarketRows,
  type BrowseSortId,
  type MarketPreviewRow,
  type PmCategory,
  validateDecimalAmount,
} from "@/lib/marketUtils";
import { PmDiscovery } from "@/components/polymarket/PmDiscovery";
import { PmFeaturedSection } from "@/components/polymarket/PmFeaturedSection";
import { PmFooter } from "@/components/polymarket/PmFooter";
import { PmNoFactory } from "@/components/polymarket/PmNoFactory";
import { PmTopicStrips } from "@/components/polymarket/PmTopicStrips";
import { PmHeroMarquee } from "@/components/polymarket/PmHeroMarquee";
import { PmTopBar, type PmAppView } from "@/components/polymarket/PmTopBar";
import { PmTradePanel } from "@/components/polymarket/PmTradePanel";
import { PortfolioView } from "@/components/polymarket/PortfolioView";
import { ActivityView } from "@/components/polymarket/ActivityView";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMarketBetLogHistory } from "@/hooks/useMarketBetLogHistory";
import { OrderBookTradePanel } from "@/components/clob/OrderBookTradePanel";
import { hasIndexer, indexerFetchMarkets, type IndexerMarket } from "@/lib/indexerClient";

const FACTORY_ENV_RAW = process.env.NEXT_PUBLIC_MARKET_FACTORY ?? "";
const FACTORY_ENV = FACTORY_ENV_RAW.trim() as `0x${string}` | "";
const FACTORY_ENV_INVALID = FACTORY_ENV.length > 0 && !isAddress(FACTORY_ENV);

const ORDERBOOK_FACTORY_ENV_RAW = process.env.NEXT_PUBLIC_ORDERBOOK_FACTORY ?? "";
const ORDERBOOK_FACTORY_ENV = ORDERBOOK_FACTORY_ENV_RAW.trim() as `0x${string}` | "";
const ORDERBOOK_FACTORY_ENV_INVALID =
  ORDERBOOK_FACTORY_ENV.length > 0 && !isAddress(ORDERBOOK_FACTORY_ENV);

const RISE_RPC =
  process.env.NEXT_PUBLIC_RISE_RPC?.trim() || "https://testnet.riselabs.xyz";

function outcomeLabel(o: number | undefined) {
  if (o === 0) return "Pending";
  if (o === 1) return "YES won";
  if (o === 2) return "NO won";
  return "—";
}

export function MarketApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const factoryAddress = useMemo(() => {
    const q = searchParams.get("factory")?.trim();
    if (q && isAddress(q)) return q as `0x${string}`;
    if (FACTORY_ENV && isAddress(FACTORY_ENV)) return FACTORY_ENV;
    return undefined;
  }, [searchParams]);

  const orderbookFactoryAddress = useMemo(() => {
    const q = searchParams.get("obFactory")?.trim();
    if (q && isAddress(q)) return q as `0x${string}`;
    if (ORDERBOOK_FACTORY_ENV && isAddress(ORDERBOOK_FACTORY_ENV)) return ORDERBOOK_FACTORY_ENV;
    return undefined;
  }, [searchParams]);

  const { address, isConnected } = useAccount();
  const { data: block } = useBlockNumber({ watch: true });

  const factoryOk = !!factoryAddress;
  const orderbookOk = !!orderbookFactoryAddress;

  const { data: marketCount } = useReadContract({
    address: factoryOk ? factoryAddress : undefined,
    abi: factoryAbi,
    functionName: "marketCount",
    query: { enabled: !!factoryOk },
  });

  const { data: obMarketCount } = useReadContract({
    address: orderbookOk ? orderbookFactoryAddress : undefined,
    abi: orderbookFactoryAbi,
    functionName: "marketCount",
    query: { enabled: !!orderbookOk },
  });

  const ids = useMemo(() => {
    const n = marketCount != null ? Number(marketCount) : 0;
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [marketCount]);

  const obIds = useMemo(() => {
    const n = obMarketCount != null ? Number(obMarketCount) : 0;
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [obMarketCount]);

  const marketsRead = useReadContracts({
    allowFailure: true,
    contracts: ids.map((id) => ({
      chainId: 11155931,
      address: (factoryOk ? factoryAddress : zeroAddress) as `0x${string}`,
      abi: factoryAbi,
      functionName: "marketById" as const,
      args: [id],
    })),
    query: { enabled: !!factoryOk && ids.length > 0 },
  });

  const obMarketsRead = useReadContracts({
    allowFailure: true,
    contracts: obIds.map((id) => ({
      chainId: 11155931,
      address: (orderbookOk ? orderbookFactoryAddress : zeroAddress) as `0x${string}`,
      abi: orderbookFactoryAbi,
      functionName: "marketById" as const,
      args: [id],
    })),
    query: { enabled: !!orderbookOk && obIds.length > 0 },
  });

  const marketAddresses = useMemo(() => {
    const res = marketsRead.data?.map((r) =>
      r.status === "success" ? (r.result as `0x${string}`) : undefined,
    );
    return (res ?? []).filter(Boolean) as `0x${string}`[];
  }, [marketsRead.data]);

  const orderbookMarketAddresses = useMemo(() => {
    const res = obMarketsRead.data?.map((r) =>
      r.status === "success" ? (r.result as `0x${string}`) : undefined,
    );
    return (res ?? []).filter(Boolean) as `0x${string}`[];
  }, [obMarketsRead.data]);

  const [indexedMarkets, setIndexedMarkets] = useState<IndexerMarket[] | null>(null);
  const [indexedMarketsErr, setIndexedMarketsErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hasIndexer()) return;
    let cancelled = false;
    async function run() {
      try {
        const rows = await indexerFetchMarkets();
        if (cancelled) return;
        setIndexedMarkets(rows ?? []);
        setIndexedMarketsErr(null);
      } catch (e) {
        if (cancelled) return;
        setIndexedMarketsErr(String((e as any)?.message ?? e));
      }
    }
    run();
    const t = setInterval(run, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const indexedPoolAddresses = useMemo(() => {
    if (!indexedMarkets) return [] as `0x${string}`[];
    return indexedMarkets
      .filter((m) => String(m.market_type).toLowerCase() === "pool")
      .map((m) => m.address as `0x${string}`);
  }, [indexedMarkets]);

  const indexedOrderbookAddresses = useMemo(() => {
    if (!indexedMarkets) return [] as `0x${string}`[];
    return indexedMarkets
      .filter((m) => String(m.market_type).toLowerCase() === "orderbook")
      .map((m) => m.address as `0x${string}`);
  }, [indexedMarkets]);

  const browsePoolAddresses =
    hasIndexer() && indexedPoolAddresses.length > 0 ? indexedPoolAddresses : marketAddresses;
  const browseOrderbookAddresses =
    hasIndexer() && indexedOrderbookAddresses.length > 0
      ? indexedOrderbookAddresses
      : orderbookMarketAddresses;

  const marketPreviews = useReadContracts({
    allowFailure: true,
    contracts: marketAddresses.flatMap((addr) => [
      {
        chainId: 11155931,
        address: addr,
        abi: marketAbi,
        functionName: "question" as const,
      },
      {
        chainId: 11155931,
        address: addr,
        abi: marketAbi,
        functionName: "totalYes" as const,
      },
      {
        chainId: 11155931,
        address: addr,
        abi: marketAbi,
        functionName: "totalNo" as const,
      },
    ]),
    query: {
      enabled: factoryOk && marketAddresses.length > 0 && !hasIndexer(),
      refetchInterval: 4_000,
    },
  });

  const obMarketPreviews = useReadContracts({
    allowFailure: true,
    contracts: orderbookMarketAddresses.map((addr) => ({
      chainId: 11155931,
      address: addr,
      abi: orderbookMarketAbi,
      functionName: "question" as const,
    })),
    query: {
      enabled: orderbookOk && orderbookMarketAddresses.length > 0 && !hasIndexer(),
      refetchInterval: 8_000,
    },
  });

  const previewRows: MarketPreviewRow[] = useMemo(() => {
    if (hasIndexer() && indexedMarkets) {
      const pool = indexedMarkets.filter(
        (m) => String(m.market_type).toLowerCase() === "pool",
      );
      return pool.map((m) => ({
        addr: m.address as `0x${string}`,
        question: String(m.question ?? ""),
        totalYes: undefined,
        totalNo: undefined,
        yesPct: 50,
      }));
    }
    const d = marketPreviews.data;
    if (!d) return [];
    return marketAddresses.map((addr, i) => {
      const base = i * 3;
      const q = d[base]?.status === "success" ? d[base].result : undefined;
      const ty =
        d[base + 1]?.status === "success"
          ? (d[base + 1].result as bigint)
          : undefined;
      const tn =
        d[base + 2]?.status === "success"
          ? (d[base + 2].result as bigint)
          : undefined;
      return {
        addr,
        question: String(q ?? ""),
        totalYes: ty,
        totalNo: tn,
        yesPct: poolYesPercent(ty, tn),
      };
    });
  }, [indexedMarkets, marketAddresses, marketPreviews.data]);

  const orderbookRows = useMemo(() => {
    if (hasIndexer() && indexedMarkets) {
      const ob = indexedMarkets.filter(
        (m) => String(m.market_type).toLowerCase() === "orderbook",
      );
      return ob.map((m) => ({
        addr: m.address as `0x${string}`,
        question: String(m.question ?? ""),
      }));
    }
    const d = obMarketPreviews.data;
    if (!d) return [] as { addr: `0x${string}`; question: string }[];
    return orderbookMarketAddresses.map((addr, i) => {
      const q = d[i]?.status === "success" ? d[i].result : undefined;
      return { addr, question: String(q ?? "") };
    });
  }, [indexedMarkets, orderbookMarketAddresses, obMarketPreviews.data]);

  const [selected, setSelected] = useState<`0x${string}` | undefined>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PmCategory>("All");
  const [sortTab, setSortTab] = useState<BrowseSortId>("new");
  const [activeQuickTag, setActiveQuickTag] = useState<string | null>(null);
  const [appView, setAppView] = useState<PmAppView>("browse");
  const [watchOnly, setWatchOnly] = useState(false);
  const { list: watchlist, toggle: watchToggle, has: watchHas } = useWatchlist();

  // URL-driven view: ?view=browse|portfolio|activity
  useEffect(() => {
    const raw = searchParams.get("view")?.trim();
    if (raw === "browse" || raw === "portfolio" || raw === "activity") {
      setAppView(raw);
    } else {
      setAppView("browse");
    }
  }, [searchParams]);

  const setViewInUrl = useCallback(
    (v: PmAppView) => {
      const p = new URLSearchParams(searchParams.toString());
      if (v === "browse") p.delete("view");
      else p.set("view", v);
      const next = `${pathname}?${p.toString()}`;
      const cur = `${pathname}?${searchParams.toString()}`;
      if (next !== cur) router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onSortTabChange = useCallback((id: BrowseSortId) => {
    setSortTab(id);
    setActiveQuickTag(null);
  }, []);

  const onCategoryChange = useCallback((c: PmCategory) => {
    setCategory(c);
    setActiveQuickTag(null);
  }, []);

  const handleQuickTag = useCallback((tag: string) => {
    setActiveQuickTag(tag);
    if (tag === "Trending") {
      setSortTab("trending");
      setCategory("All");
      setSearch("");
      return;
    }
    if (tag === "New") {
      setSortTab("new");
      setCategory("All");
      setSearch("");
      return;
    }
    if ((PM_CATEGORIES as readonly string[]).includes(tag)) {
      setCategory(tag as PmCategory);
      return;
    }
    setSearch(tag.toLowerCase());
  }, []);

  useEffect(() => {
    const all = [...browseOrderbookAddresses, ...browsePoolAddresses];
    if (!all.length) {
      setSelected(undefined);
      return;
    }
    const q = searchParams.get("market")?.trim();
    if (q && isAddress(q) && all.includes(q as `0x${string}`)) {
      setSelected(q as `0x${string}`);
      return;
    }
    setSelected((prev) => {
      if (prev && all.includes(prev)) return prev;
      return all[0];
    });
  }, [browsePoolAddresses, browseOrderbookAddresses, searchParams]);

  const syncMarketUrl = useCallback(
    (addr: `0x${string}` | undefined) => {
      const p = new URLSearchParams(searchParams.toString());
      if (addr) p.set("market", addr);
      else p.delete("market");
      const next = `${pathname}?${p.toString()}`;
      const cur = `${pathname}?${searchParams.toString()}`;
      if (next !== cur) router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!selected || (!factoryOk && !orderbookOk)) return;
    if (searchParams.get("market")?.trim()) return;
    syncMarketUrl(selected);
  }, [selected, factoryOk, orderbookOk, searchParams, syncMarketUrl]);

  const onSelectMarket = useCallback(
    (addr: `0x${string}`) => {
      setSelected(addr);
      syncMarketUrl(addr);
    },
    [syncMarketUrl],
  );

  const openMarketFromAux = useCallback(
    (addr: `0x${string}`) => {
      setViewInUrl("browse");
      onSelectMarket(addr);
    },
    [onSelectMarket, setViewInUrl],
  );

  const browsePreviewRows: MarketPreviewRow[] = useMemo(() => {
    const obAsPreview: MarketPreviewRow[] = orderbookRows.map((r) => ({
      addr: r.addr,
      question: r.question,
      totalYes: undefined,
      totalNo: undefined,
      yesPct: 50,
    }));
    // Put orderbook markets first (they also have their own section),
    // then pool markets.
    return [...obAsPreview, ...previewRows];
  }, [orderbookRows, previewRows]);

  const filteredRows = useMemo(
    () => filterMarketRows(browsePreviewRows, { search, category }),
    [browsePreviewRows, search, category],
  );

  const watchFilteredRows = useMemo(() => {
    if (!watchOnly) return filteredRows;
    const wl = new Set(watchlist.map((a) => a.toLowerCase()));
    return filteredRows.filter((r) => wl.has(r.addr.toLowerCase()));
  }, [filteredRows, watchOnly, watchlist]);

  const featuredRows = useMemo(() => {
    const byVol = [...watchFilteredRows].sort((a, b) => {
      const va = (a.totalYes ?? 0n) + (a.totalNo ?? 0n);
      const vb = (b.totalYes ?? 0n) + (b.totalNo ?? 0n);
      if (vb > va) return 1;
      if (vb < va) return -1;
      return 0;
    });
    return byVol.slice(0, Math.min(4, byVol.length));
  }, [watchFilteredRows]);

  /** Full list per sort tab — same markets as Featured (top strip is a highlight, not excluded). */
  const listRows = useMemo(
    () => sortMarketRows(watchFilteredRows, sortTab),
    [watchFilteredRows, sortTab],
  );

  const m = selected;
  const isOrderbook = !!m && browseOrderbookAddresses.includes(m);

  const marketCore = useReadContracts({
    allowFailure: true,
    contracts: m && !isOrderbook
      ? [
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "question" },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "collateral" },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "oracle" },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "tradingEndsAt" },
          {
            chainId: 11155931,
            address: m,
            abi: marketAbi,
            functionName: "claimDelayAfterResolve",
          },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "claimsOpenAt" },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "totalYes" },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "totalNo" },
          { chainId: 11155931, address: m, abi: marketAbi, functionName: "outcome" },
        ]
      : [],
    query: { enabled: !!m, refetchInterval: 4_000 },
  });

  const obCore = useReadContracts({
    allowFailure: true,
    contracts: m && isOrderbook
      ? [
          { chainId: 11155931, address: m, abi: orderbookMarketAbi, functionName: "question" },
          { chainId: 11155931, address: m, abi: orderbookMarketAbi, functionName: "oracle" },
          { chainId: 11155931, address: m, abi: orderbookMarketAbi, functionName: "tradingEndsAt" },
          {
            chainId: 11155931,
            address: m,
            abi: orderbookMarketAbi,
            functionName: "claimDelayAfterResolve",
          },
          { chainId: 11155931, address: m, abi: orderbookMarketAbi, functionName: "claimsOpenAt" },
          { chainId: 11155931, address: m, abi: orderbookMarketAbi, functionName: "outcome" },
        ]
      : [],
    query: { enabled: !!m && isOrderbook, refetchInterval: 6_000 },
  });

  const { data: yesStake } = useReadContract({
    chainId: 11155931,
    address: m,
    abi: marketAbi,
    functionName: "yesStake",
    args: address ? [address] : undefined,
    query: { enabled: !!m && !!address && !isOrderbook },
  });

  const { data: noStake } = useReadContract({
    chainId: 11155931,
    address: m,
    abi: marketAbi,
    functionName: "noStake",
    args: address ? [address] : undefined,
    query: { enabled: !!m && !!address && !isOrderbook },
  });

  const { data: claimed } = useReadContract({
    chainId: 11155931,
    address: m,
    abi: marketAbi,
    functionName: "claimed",
    args: address ? [address] : undefined,
    query: { enabled: !!m && !!address && !isOrderbook },
  });

  const core = marketCore.data;
  const ob = obCore.data;

  const question = isOrderbook
    ? (ob?.[0]?.status === "success" ? String(ob[0].result ?? "") : undefined)
    : (core?.[0]?.status === "success" ? String(core[0].result ?? "") : undefined);

  const collateral = !isOrderbook
    ? (core?.[1]?.status === "success" ? core[1].result : undefined)
    : undefined;

  const oracle = isOrderbook
    ? (ob?.[1]?.status === "success" ? ob[1].result : undefined)
    : (core?.[2]?.status === "success" ? core[2].result : undefined);

  const tradingEndsAt = isOrderbook
    ? (ob?.[2]?.status === "success" ? ob[2].result : undefined)
    : (core?.[3]?.status === "success" ? core[3].result : undefined);

  const claimDelayAfterResolve = isOrderbook
    ? (ob?.[3]?.status === "success" ? ob[3].result : undefined)
    : (core?.[4]?.status === "success" ? core[4].result : undefined);

  const claimsOpenAt = isOrderbook
    ? (ob?.[4]?.status === "success" ? ob[4].result : undefined)
    : (core?.[5]?.status === "success" ? core[5].result : undefined);

  const totalYes = !isOrderbook
    ? (core?.[6]?.status === "success" ? core[6].result : undefined)
    : undefined;

  const totalNo = !isOrderbook
    ? (core?.[7]?.status === "success" ? core[7].result : undefined)
    : undefined;

  const outcome = isOrderbook
    ? (ob?.[5]?.status === "success" ? ob[5].result : undefined)
    : (core?.[8]?.status === "success" ? core[8].result : undefined);

  const collateralAddr = collateral as `0x${string}` | undefined;
  const isEth = !collateralAddr || collateralAddr === zeroAddress;

  const { data: tokenDecimals } = useReadContract({
    chainId: 11155931,
    address: !isEth ? collateralAddr : undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!collateralAddr && !isEth && !isOrderbook },
  });

  const decimals = typeof tokenDecimals === "number" ? tokenDecimals : 18;

  const [amountStr, setAmountStr] = useState("0.01");
  const amountOk = validateDecimalAmount(amountStr);
  const amountError = useMemo(() => {
    if (amountStr.trim() === "") return null;
    return amountOk.ok ? null : amountOk.error;
  }, [amountStr, amountOk]);

  const tradeWei = useMemo(() => {
    if (!amountOk.ok) return 0n;
    return isEth
      ? parseEther(amountOk.value)
      : parseUnits(amountOk.value, decimals);
  }, [amountOk, isEth, decimals]);

  const { data: allowance } = useReadContract({
    chainId: 11155931,
    address: !isEth && collateralAddr ? collateralAddr : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && m && !isEth && collateralAddr
        ? [address, m]
        : undefined,
    query: {
      enabled: !!address && !!m && !!collateralAddr && !isEth && !isOrderbook,
      refetchInterval: 4_000,
    },
  });

  const needsApproval =
    !isEth &&
    !!address &&
    !!m &&
    (() => {
      if (!amountOk.ok) return (allowance ?? 0n) === 0n;
      return (allowance ?? 0n) < tradeWei;
    })();

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (confirmed) reset();
  }, [confirmed, reset]);

  const nowSec = useMemo(() => Math.floor(Date.now() / 1000), [block]);

  const tradingOpen =
    typeof tradingEndsAt === "bigint" && nowSec < Number(tradingEndsAt);
  const outcomeNum = typeof outcome === "bigint" ? Number(outcome) : 0;
  const claimsReady =
    typeof claimsOpenAt === "bigint" &&
    outcomeNum !== 0 &&
    nowSec >= Number(claimsOpenAt);

  const isOracle =
    !!address &&
    !!oracle &&
    typeof oracle === "string" &&
    address.toLowerCase() === oracle.toLowerCase();

  const betAmountOk = amountOk.ok && tradeWei > 0n;
  const tradeDisabled = !betAmountOk || !!amountError;

  const safeBetYes = () => {
    if (!m || !betAmountOk || !amountOk.ok) return;
    try {
      const amt = isEth ? parseEther(amountOk.value) : parseUnits(amountOk.value, decimals);
      writeContract({
        chainId: 11155931,
        address: m,
        abi: marketAbi,
        functionName: "betYes",
        args: [amt],
        value: isEth ? amt : 0n,
      });
    } catch {
      /* viem throws on bad parse — blocked by validateDecimalAmount */
    }
  };

  const safeBetNo = () => {
    if (!m || !betAmountOk || !amountOk.ok) return;
    try {
      const amt = isEth ? parseEther(amountOk.value) : parseUnits(amountOk.value, decimals);
      writeContract({
        chainId: 11155931,
        address: m,
        abi: marketAbi,
        functionName: "betNo",
        args: [amt],
        value: isEth ? amt : 0n,
      });
    } catch {
      /* same */
    }
  };

  const onApprove = () => {
    if (!m || !collateralAddr || isEth || isOrderbook) return;
    writeContract({
      chainId: 11155931,
      address: collateralAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [m, 2n ** 256n - 1n],
    });
  };

  const onResolve = (yes: boolean) => {
    if (!m) return;
    writeContract({
      chainId: 11155931,
      address: m,
      abi: marketAbi,
      functionName: "resolve",
      args: [yes],
    });
  };

  const onClaim = () => {
    if (!m) return;
    writeContract({
      chainId: 11155931,
      address: m,
      abi: marketAbi,
      functionName: "claim",
    });
  };

  const fmt = (v: bigint | undefined) => {
    if (v == null) return "…";
    return isEth
      ? `${formatUnits(v, 18)} ETH`
      : `${formatUnits(v, decimals)} USDC`;
  };

  const selectedYesPct = poolYesPercent(
    totalYes as bigint | undefined,
    totalNo as bigint | undefined,
  );

  const yesPctRef = useRef(selectedYesPct);
  yesPctRef.current = selectedYesPct;

  const {
    points: logChartPoints,
    status: logHistStatus,
  } = useMarketBetLogHistory(RISE_RPC, m);

  const [priceHistory, setPriceHistory] = useState<{ t: number; yesPct: number }[]>(
    [],
  );

  useEffect(() => {
    if (!m) {
      setPriceHistory([]);
      return;
    }
    setPriceHistory([{ t: Date.now(), yesPct: yesPctRef.current }]);
  }, [m]);

  useEffect(() => {
    if (!m || isOrderbook || logHistStatus !== "ok") return;
    if (logChartPoints.length >= 2) {
      setPriceHistory(logChartPoints);
    } else if (logChartPoints.length === 1) {
      setPriceHistory([logChartPoints[0]!, { t: Date.now(), yesPct: yesPctRef.current }]);
    }
  }, [m, isOrderbook, logHistStatus, logChartPoints]);

  useEffect(() => {
    if (!m || isOrderbook) return;
    const id = setInterval(() => {
      setPriceHistory((prev) => {
        const next = [...prev, { t: Date.now(), yesPct: yesPctRef.current }];
        return next.slice(-220);
      });
    }, 5000);
    return () => clearInterval(id);
  }, [m, isOrderbook]);

  if (!factoryOk) {
    const exampleUrl =
      origin.length > 0
        ? `${origin}${origin.includes("?") ? "&" : "?"}factory=0x…`
        : "http://127.0.0.1:3010?factory=0x…";
    return (
      <PmNoFactory factoryEnvInvalid={FACTORY_ENV_INVALID} exampleUrl={exampleUrl} />
    );
  }

  const marketCountLabel =
    marketCount != null ? `${marketCount} market${marketCount === 1n ? "" : "s"}` : "…";
  const blockLabel =
    block != null ? (
      <>
        <span className="mx-2 text-[#484f58]">·</span>
        block {String(block)}
      </>
    ) : null;

  const priceChartLabel =
    logHistStatus === "ok" && logChartPoints.length >= 2
      ? "Implied Yes (on-chain bet history)"
      : "Implied Yes (live session + pool)";

  return (
    <div className="min-h-screen bg-[var(--pm-bg)]">
      <PmTopBar
        appView={appView}
        onAppViewChange={setViewInUrl}
        search={appView === "browse" ? search : ""}
        onSearchChange={appView === "browse" ? setSearch : undefined}
      />
      {appView === "browse" ? (
        <>
          <PmTopicStrips
            category={category}
            onCategoryChange={onCategoryChange}
            activeQuickTag={activeQuickTag}
            onQuickTag={handleQuickTag}
          />
        </>
      ) : null}
      <main className="mx-auto max-w-[1320px] px-4 pb-8 pt-5 lg:px-5">
        {appView === "portfolio" ? (
          !isConnected || !address ? (
            <div className="rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/40 px-6 py-16 text-center">
              <p className="text-[17px] font-medium text-white">Connect your wallet</p>
              <p className="mt-2 text-[14px] text-[#8b949e]">
                Portfolio shows YES / NO stakes across all factory markets.
              </p>
            </div>
          ) : (
            <PortfolioView
              chainId={11155931}
              marketAddresses={browsePoolAddresses}
              previewRows={previewRows}
              user={address}
              onOpenMarket={openMarketFromAux}
            />
          )
        ) : appView === "activity" ? (
          <ActivityView
            rpcUrl={RISE_RPC}
            marketAddresses={browsePoolAddresses}
            previewRows={previewRows}
            onOpenMarket={openMarketFromAux}
          />
        ) : !m || (!factoryAddress && !orderbookFactoryAddress) ? (
          <div className="rounded-2xl border border-dashed border-[var(--pm-border)] bg-[var(--pm-surface)]/40 px-6 py-16 text-center">
            <p className="text-[17px] font-medium text-white">No open markets</p>
            <p className="mt-2 text-[14px] text-[#8b949e]">
              From repo root, with a funded{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">PRIVATE_KEY</code>:{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px] text-[#c9d1d9]">
                bash scripts/create-dummy-markets.sh
              </code>
            </p>
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_min(420px,100%)] xl:items-start">
            <div className="min-w-0">
              <PmHeroMarquee
                rows={browsePreviewRows}
                selected={selected}
                onSelect={onSelectMarket}
              />
              {orderbookRows.length > 0 ? (
                <section className="mb-10">
                  <h2 className="mb-4 text-[20px] font-bold tracking-tight text-white md:text-[22px]">
                    Orderbook markets
                  </h2>
                  <div className="pm-scroll max-h-[520px] overflow-auto rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] p-3">
                    <div className="grid gap-3">
                      {orderbookRows.map((r) => {
                      const active = selected === r.addr;
                      return (
                        <button
                          key={r.addr}
                          type="button"
                          onClick={() => onSelectMarket(r.addr)}
                          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            active
                              ? "border-[var(--pm-yes)]/55 bg-[#0f1915]"
                              : "border-[var(--pm-border)] bg-[var(--pm-surface)] hover:bg-[var(--pm-surface-2)]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-[14px] font-semibold text-white">
                              {r.question || r.addr}
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-[#6e7681]">{r.addr}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200/90">
                            CLOB
                          </span>
                        </button>
                      );
                      })}
                    </div>
                  </div>
                </section>
              ) : null}
              {featuredRows.length > 0 ? (
                <PmFeaturedSection
                  rows={featuredRows}
                  selected={selected}
                  onSelect={onSelectMarket}
                  watchHas={watchHas}
                  onWatchToggle={watchToggle}
                />
              ) : null}
              <PmDiscovery
                listRows={listRows}
                selected={selected}
                onSelect={onSelectMarket}
                sortTab={sortTab}
                watchHas={watchHas}
                onWatchToggle={watchToggle}
                watchOnly={watchOnly}
                onWatchOnlyChange={setWatchOnly}
              />
            </div>
            {isOrderbook ? (
              <OrderBookTradePanel
                market={m}
                question={question ?? "…"}
                oracle={oracle as `0x${string}` | undefined}
                tradingEndsAt={tradingEndsAt as bigint | undefined}
                claimsOpenAt={claimsOpenAt as bigint | undefined}
                outcomeNum={outcomeNum}
                isOracle={isOracle}
              />
            ) : (
              <PmTradePanel
                factoryAddress={factoryAddress ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`)}
                blockLabel={blockLabel}
                marketCountLabel={marketCountLabel}
                m={m}
                question={question ?? "…"}
                collateralAddr={collateralAddr}
                isEth={isEth}
                decimals={decimals}
                oracle={oracle != null ? String(oracle) : undefined}
                tradingEndsAt={tradingEndsAt as bigint | undefined}
                claimsOpenAt={claimsOpenAt as bigint | undefined}
                claimDelayAfterResolve={claimDelayAfterResolve as bigint | undefined}
                totalYes={totalYes as bigint | undefined}
                totalNo={totalNo as bigint | undefined}
                outcomeNum={outcomeNum}
                tradingOpen={tradingOpen}
                claimsReady={claimsReady}
                selectedYesPct={selectedYesPct}
                address={address}
                isConnected={isConnected}
                yesStake={yesStake as bigint | undefined}
                noStake={noStake as bigint | undefined}
                claimed={claimed as boolean | undefined}
                isOracle={isOracle}
                amountStr={amountStr}
                onAmountChange={setAmountStr}
                amountError={amountError}
                tradeDisabled={tradeDisabled}
                needsApproval={Boolean(needsApproval)}
                onApprove={onApprove}
                onBetYes={safeBetYes}
                onBetNo={safeBetNo}
                onResolve={onResolve}
                onClaim={onClaim}
                fmt={fmt}
                outcomeLabel={outcomeLabel}
                txHash={hash}
                txError={error}
                isPending={isPending}
                confirming={confirming}
                confirmed={confirmed}
                priceHistory={priceHistory}
                priceChartLabel={priceChartLabel}
              />
            )}
          </div>
        )}
      </main>
      <PmFooter />
    </div>
  );
}
