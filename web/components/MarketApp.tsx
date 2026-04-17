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
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { factoryAbi, marketAbi, erc20Abi } from "@/lib/abi";
import {
  filterMarketRows,
  poolYesPercent,
  type MarketPreviewRow,
  type PmCategory,
  validateDecimalAmount,
} from "@/lib/marketUtils";
import { PmDiscovery } from "@/components/polymarket/PmDiscovery";
import { PmNoFactory } from "@/components/polymarket/PmNoFactory";
import { PmTopBar } from "@/components/polymarket/PmTopBar";
import { PmTradePanel } from "@/components/polymarket/PmTradePanel";

const FACTORY_ENV_RAW = process.env.NEXT_PUBLIC_MARKET_FACTORY ?? "";
const FACTORY_ENV = FACTORY_ENV_RAW.trim() as `0x${string}` | "";
const FACTORY_ENV_INVALID = FACTORY_ENV.length > 0 && !isAddress(FACTORY_ENV);

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

  const { address, isConnected } = useAccount();
  const { data: block } = useBlockNumber({ watch: true });

  const factoryOk = !!factoryAddress;

  const { data: marketCount } = useReadContract({
    address: factoryOk ? factoryAddress : undefined,
    abi: factoryAbi,
    functionName: "marketCount",
    query: { enabled: !!factoryOk },
  });

  const ids = useMemo(() => {
    const n = marketCount != null ? Number(marketCount) : 0;
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [marketCount]);

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

  const marketAddresses = useMemo(() => {
    const res = marketsRead.data?.map((r) =>
      r.status === "success" ? (r.result as `0x${string}`) : undefined,
    );
    return (res ?? []).filter(Boolean) as `0x${string}`[];
  }, [marketsRead.data]);

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
      enabled: factoryOk && marketAddresses.length > 0,
      refetchInterval: 4_000,
    },
  });

  const previewRows: MarketPreviewRow[] = useMemo(() => {
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
  }, [marketAddresses, marketPreviews.data]);

  const [selected, setSelected] = useState<`0x${string}` | undefined>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PmCategory>("All");

  useEffect(() => {
    if (!marketAddresses.length) {
      setSelected(undefined);
      return;
    }
    const q = searchParams.get("market")?.trim();
    if (q && isAddress(q) && marketAddresses.includes(q as `0x${string}`)) {
      setSelected(q as `0x${string}`);
      return;
    }
    setSelected((prev) => {
      if (prev && marketAddresses.includes(prev)) return prev;
      return marketAddresses[0];
    });
  }, [marketAddresses, searchParams]);

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
    if (!selected || !factoryOk) return;
    if (searchParams.get("market")?.trim()) return;
    syncMarketUrl(selected);
  }, [selected, factoryOk, searchParams, syncMarketUrl]);

  const onSelectMarket = useCallback(
    (addr: `0x${string}`) => {
      setSelected(addr);
      syncMarketUrl(addr);
    },
    [syncMarketUrl],
  );

  const filteredRows = useMemo(
    () => filterMarketRows(previewRows, { search, category }),
    [previewRows, search, category],
  );

  const m = selected;

  const marketCore = useReadContracts({
    allowFailure: true,
    contracts: m
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

  const { data: yesStake } = useReadContract({
    chainId: 11155931,
    address: m,
    abi: marketAbi,
    functionName: "yesStake",
    args: address ? [address] : undefined,
    query: { enabled: !!m && !!address },
  });

  const { data: noStake } = useReadContract({
    chainId: 11155931,
    address: m,
    abi: marketAbi,
    functionName: "noStake",
    args: address ? [address] : undefined,
    query: { enabled: !!m && !!address },
  });

  const { data: claimed } = useReadContract({
    chainId: 11155931,
    address: m,
    abi: marketAbi,
    functionName: "claimed",
    args: address ? [address] : undefined,
    query: { enabled: !!m && !!address },
  });

  const core = marketCore.data;
  const question =
    core?.[0]?.status === "success" ? String(core[0].result ?? "") : undefined;
  const collateral =
    core?.[1]?.status === "success" ? core[1].result : undefined;
  const oracle = core?.[2]?.status === "success" ? core[2].result : undefined;
  const tradingEndsAt =
    core?.[3]?.status === "success" ? core[3].result : undefined;
  const claimDelayAfterResolve =
    core?.[4]?.status === "success" ? core[4].result : undefined;
  const claimsOpenAt =
    core?.[5]?.status === "success" ? core[5].result : undefined;
  const totalYes = core?.[6]?.status === "success" ? core[6].result : undefined;
  const totalNo = core?.[7]?.status === "success" ? core[7].result : undefined;
  const outcome = core?.[8]?.status === "success" ? core[8].result : undefined;

  const collateralAddr = collateral as `0x${string}` | undefined;
  const isEth = !collateralAddr || collateralAddr === zeroAddress;

  const { data: tokenDecimals } = useReadContract({
    chainId: 11155931,
    address: !isEth ? collateralAddr : undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!collateralAddr && !isEth },
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
      enabled: !!address && !!m && !!collateralAddr && !isEth,
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
    if (!m || !collateralAddr || isEth) return;
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

  return (
    <div className="min-h-screen bg-[var(--pm-bg)]">
      <PmTopBar category={category} onCategoryChange={setCategory} />
      <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-5 lg:px-5">
        {!m || !factoryAddress ? (
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
            <PmDiscovery
              rows={filteredRows}
              selected={selected}
              onSelect={onSelectMarket}
              search={search}
              onSearchChange={setSearch}
            />
            <PmTradePanel
              factoryAddress={factoryAddress}
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
            />
          </div>
        )}
      </main>
    </div>
  );
}
