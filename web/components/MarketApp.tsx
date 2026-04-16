"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
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
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { factoryAbi, marketAbi, erc20Abi } from "@/lib/abi";

const FACTORY_ENV_RAW = process.env.NEXT_PUBLIC_MARKET_FACTORY ?? "";
const FACTORY_ENV = FACTORY_ENV_RAW.trim() as `0x${string}` | "";
const FACTORY_ENV_INVALID =
  FACTORY_ENV.length > 0 && !isAddress(FACTORY_ENV);

function outcomeLabel(o: number | undefined) {
  if (o === 0) return "Pending";
  if (o === 1) return "YES won";
  if (o === 2) return "NO won";
  return "—";
}

function poolYesPercent(
  totalYes: bigint | undefined,
  totalNo: bigint | undefined,
): number {
  const ty = totalYes ?? 0n;
  const tn = totalNo ?? 0n;
  const t = ty + tn;
  if (t === 0n) return 50;
  return Number((ty * 10000n) / t) / 100;
}

export function MarketApp() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const searchParams = useSearchParams();
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

  const previewRows = useMemo(() => {
    const d = marketPreviews.data;
    if (!d) return [];
    return marketAddresses.map((addr, i) => {
      const base = i * 3;
      const q =
        d[base]?.status === "success" ? d[base].result : undefined;
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

  useEffect(() => {
    if (!selected && marketAddresses.length > 0) {
      setSelected(marketAddresses[0]);
    }
  }, [marketAddresses, selected]);

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
    core?.[0]?.status === "success" ? core[0].result : undefined;
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

  const onBetYes = () => {
    if (!m) return;
    const amt = isEth ? parseEther(amountStr) : parseUnits(amountStr, decimals);
    writeContract({
      chainId: 11155931,
      address: m,
      abi: marketAbi,
      functionName: "betYes",
      args: [amt],
      value: isEth ? amt : 0n,
    });
  };

  const onBetNo = () => {
    if (!m) return;
    const amt = isEth ? parseEther(amountStr) : parseUnits(amountStr, decimals);
    writeContract({
      chainId: 11155931,
      address: m,
      abi: marketAbi,
      functionName: "betNo",
      args: [amt],
      value: isEth ? amt : 0n,
    });
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
    return isEth ? `${formatUnits(v, 18)} ETH` : `${formatUnits(v, decimals)} USDC`;
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
      <div className="min-h-screen">
        <PmNav />
        <div className="mx-auto max-w-xl px-4 pb-20 pt-12">
          <div className="rounded-2xl border border-white/[0.08] bg-[#12161d] p-8 shadow-2xl shadow-black/40">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00d395]">
              Setup
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Connect a MarketFactory
            </h1>
            {FACTORY_ENV_INVALID ? (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/95">
                <code className="text-[#00d395]">NEXT_PUBLIC_MARKET_FACTORY</code> in{" "}
                <code className="text-white/90">.env.local</code> is not a valid address. Use
                the 42‑character address from deploy logs, save, and restart{" "}
                <code className="text-white/90">npm run dev</code>.
              </p>
            ) : null}
            <p className="mt-4 text-sm leading-relaxed text-[#8b949e]">
              Point this app at your deployed factory on RISE testnet, then reload.
            </p>
            <ol className="mt-6 space-y-4 text-sm text-[#c9d1d9]">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-white">
                  1
                </span>
                <div>
                  <p className="font-medium text-white">Env file</p>
                  <p className="mt-1 text-[#8b949e]">
                    In <code className="text-[#e6edf3]">web/</code>:{" "}
                    <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">
                      cp env.example .env.local
                    </code>{" "}
                    → set{" "}
                    <code className="break-all rounded bg-black/40 px-1.5 py-0.5 text-xs">
                      NEXT_PUBLIC_MARKET_FACTORY=0x…
                    </code>
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-white">
                  2
                </span>
                <div>
                  <p className="font-medium text-white">Or URL</p>
                  <code className="mt-1 block break-all rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-[#8b949e]">
                    {exampleUrl}
                  </code>
                </div>
              </li>
            </ol>
            <div className="mt-8 rounded-xl border border-white/[0.06] bg-black/25 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6e7681]">
                Deploy factory (repo root)
              </p>
              <code className="mt-2 block break-all text-[11px] leading-relaxed text-[#8b949e]">
                export PRIVATE_KEY=0x…
                <br />
                forge script script/Deploy.s.sol:Deploy --rpc-url
                https://testnet.riselabs.xyz --broadcast
              </code>
            </div>
            <p className="mt-6 text-xs text-[#6e7681]">
              <a
                className="text-[#00d395] hover:underline"
                href="https://docs.risechain.com/docs/builders/testnet-details"
                target="_blank"
                rel="noreferrer"
              >
                RISE testnet
              </a>
              {" · "}
              WalletConnect only if{" "}
              <code className="rounded bg-white/[0.06] px-1">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code>{" "}
              is set (
              <a
                className="text-[#00d395] hover:underline"
                href="https://cloud.reown.com"
                target="_blank"
                rel="noreferrer"
              >
                Reown
              </a>
              ).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PmNav />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
        <p className="mb-8 font-mono text-[11px] leading-relaxed text-[#6e7681]">
          <span className="text-[#8b949e]">Factory</span>{" "}
          <span className="break-all text-[#c9d1d9]">{factoryAddress}</span>
          <span className="mx-2 text-[#484f58]">·</span>
          {marketCount != null ? `${marketCount} market${marketCount === 1n ? "" : "s"}` : "…"}
          {block != null ? (
            <>
              <span className="mx-2 text-[#484f58]">·</span>
              block {String(block)}
            </>
          ) : null}
          <span className="mx-2 text-[#484f58]">·</span>
          <a
            className="text-[#00d395] hover:underline"
            href="https://docs.risechain.com/docs/builders/testnet-details"
            target="_blank"
            rel="noreferrer"
          >
            RISE testnet
          </a>
        </p>

        {previewRows.length > 0 ? (
          <div className="mb-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
              Markets
            </h2>
            <ul className="space-y-2">
              {previewRows.map((row) => {
                const active = selected === row.addr;
                return (
                  <li key={row.addr}>
                    <button
                      type="button"
                      onClick={() => setSelected(row.addr)}
                      className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-[#00d395]/45 bg-[#151b24] shadow-[0_0_0_1px_rgba(0,211,149,0.15)]"
                          : "border-white/[0.08] bg-[#12161d] hover:border-white/[0.12] hover:bg-[#1a2029]"
                      }`}
                    >
                      <p className="line-clamp-2 text-[15px] font-medium leading-snug text-white">
                        {row.question || "Untitled market"}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <OddsBar yesPct={row.yesPct} />
                        <span className="shrink-0 tabular-nums text-xs text-[#8b949e]">
                          {row.yesPct.toFixed(0)}% Yes
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {!m ? (
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#12161d]/50 px-6 py-14 text-center">
            <p className="text-lg font-medium text-white">No open markets</p>
            <p className="mt-2 text-sm text-[#8b949e]">
              From repo root, with a funded{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">PRIVATE_KEY</code>:{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-[#c9d1d9]">
                bash scripts/create-dummy-markets.sh
              </code>{" "}
              (several demo markets) or{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-[#c9d1d9]">
                bash scripts/create-markets.sh
              </code>{" "}
              (one ETH + optional USDC).
            </p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12161d] shadow-2xl shadow-black/50">
            <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      tradingOpen
                        ? "bg-[#00d395]/15 text-[#00d395]"
                        : "bg-white/[0.06] text-[#8b949e]"
                    }`}
                  >
                    {tradingOpen ? "Live" : "Closed"}
                  </span>
                  <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
                    {String(question ?? "…")}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-[#6e7681]">
                    Implied Yes
                  </p>
                  <p className="text-3xl font-semibold tabular-nums text-[#00d395]">
                    {selectedYesPct.toFixed(0)}¢
                  </p>
                  <p className="text-[11px] text-[#6e7681]">
                    pool-weighted (not an order book)
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <OddsBar yesPct={selectedYesPct} />
                <div className="mt-2 flex justify-between text-xs tabular-nums text-[#8b949e]">
                  <span>Yes {fmt(totalYes as bigint | undefined)}</span>
                  <span>No {fmt(totalNo as bigint | undefined)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
              <PmStat label="Collateral" value={isEth ? "ETH" : String(collateralAddr)} />
              <PmStat label="Outcome" value={outcomeLabel(outcomeNum)} />
              <PmStat
                label="Trading ends"
                value={
                  tradingEndsAt != null
                    ? new Date(Number(tradingEndsAt) * 1000).toLocaleString()
                    : "…"
                }
              />
              <PmStat
                label="Claims"
                value={
                  claimsOpenAt != null && Number(claimsOpenAt) > 0
                    ? new Date(Number(claimsOpenAt) * 1000).toLocaleString()
                    : "—"
                }
              />
              <PmStat
                className="sm:col-span-2"
                label="Oracle"
                value={oracle ? String(oracle) : "…"}
                mono
              />
            </div>

            <div className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e7681]">
                Your position
              </p>
              <p className="mt-2 text-sm text-[#c9d1d9]">
                {!isConnected
                  ? "Connect a wallet on RISE Testnet to trade."
                  : `YES ${fmt(yesStake as bigint | undefined)} · NO ${fmt(noStake as bigint | undefined)} · Claimed ${String(claimed ?? false)}`}
              </p>
            </div>

            <div className="border-t border-white/[0.06] bg-black/20 px-5 py-6 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e7681]">
                Trade
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="flex flex-col gap-1.5 text-[11px] text-[#8b949e] sm:col-span-2">
                  Amount ({isEth ? "ETH" : "token"})
                  <input
                    className="rounded-xl border border-white/[0.1] bg-[#0b0e11] px-4 py-3 text-base text-white outline-none ring-[#00d395]/30 focus:ring-2"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                  />
                </label>
                {!isEth ? (
                  <button
                    type="button"
                    onClick={onApprove}
                    disabled={!isConnected || isPending || confirming}
                    className="rounded-xl border border-white/[0.12] px-4 py-3 text-sm font-medium text-[#e6edf3] hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    Approve
                  </button>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onBetYes}
                  disabled={!isConnected || !tradingOpen || isPending || confirming}
                  className="rounded-xl bg-[#00d395] py-4 text-sm font-semibold text-[#0b0e11] shadow-lg shadow-[#00d395]/20 hover:bg-[#00e5a3] disabled:opacity-40"
                >
                  Buy Yes
                </button>
                <button
                  type="button"
                  onClick={onBetNo}
                  disabled={!isConnected || !tradingOpen || isPending || confirming}
                  className="rounded-xl bg-[#ff4e4e] py-4 text-sm font-semibold text-white shadow-lg shadow-[#ff4e4e]/15 hover:bg-[#ff6666] disabled:opacity-40"
                >
                  Buy No
                </button>
              </div>
            </div>

            {isOracle ? (
              <div className="border-t border-amber-500/20 bg-amber-500/[0.06] px-5 py-5 sm:px-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
                  Oracle
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
                    disabled={tradingOpen || isPending || confirming}
                    onClick={() => onResolve(true)}
                  >
                    Resolve YES
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-amber-500/50 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/10 disabled:opacity-40"
                    disabled={tradingOpen || isPending || confirming}
                    onClick={() => onResolve(false)}
                  >
                    Resolve NO
                  </button>
                </div>
                <p className="mt-2 text-xs text-amber-200/70">
                  Available after trading window ends.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-5 py-5 sm:px-6">
              <button
                type="button"
                onClick={onClaim}
                disabled={
                  !isConnected ||
                  !claimsReady ||
                  Boolean(claimed) ||
                  isPending ||
                  confirming
                }
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0b0e11] hover:bg-[#e6edf3] disabled:opacity-40"
              >
                Claim
              </button>
              {hash ? (
                <a
                  className="text-xs text-[#00d395] hover:underline"
                  href={`https://explorer.testnet.riselabs.xyz/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              ) : null}
              {error ? (
                <p className="w-full text-xs text-[#ff4e4e]">{error.message}</p>
              ) : null}
              {isPending || confirming ? (
                <p className="w-full text-xs text-[#8b949e]">
                  {isPending ? "Confirm in wallet…" : "Confirming…"}
                </p>
              ) : null}
              {confirmed ? (
                <p className="w-full text-xs text-[#00d395]">Confirmed.</p>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PmNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0b0e11]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3.5">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-white">RISE</span>
          <span className="text-sm font-medium text-[#6e7681]">Markets</span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}

function OddsBar({ yesPct }: { yesPct: number }) {
  const y = Math.min(100, Math.max(0, yesPct));
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="bg-[#00d395] transition-[width] duration-300"
        style={{ width: `${y}%` }}
      />
      <div
        className="bg-[#ff4e4e] transition-[width] duration-300"
        style={{ width: `${100 - y}%` }}
      />
    </div>
  );
}

function PmStat({
  label,
  value,
  mono,
  className = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-[#12161d] px-5 py-4 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#6e7681]">
        {label}
      </p>
      <p
        className={`mt-1 break-all text-sm text-[#e6edf3] ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
