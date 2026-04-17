"use client";

import type { ReactNode } from "react";
import { zeroAddress } from "viem";

type Props = {
  factoryAddress: `0x${string}`;
  blockLabel: ReactNode;
  marketCountLabel: ReactNode;
  m: `0x${string}`;
  question: string;
  collateralAddr: `0x${string}` | undefined;
  isEth: boolean;
  decimals: number;
  oracle: string | undefined;
  tradingEndsAt: bigint | undefined;
  claimsOpenAt: bigint | undefined;
  claimDelayAfterResolve: bigint | undefined;
  totalYes: bigint | undefined;
  totalNo: bigint | undefined;
  outcomeNum: number;
  tradingOpen: boolean;
  claimsReady: boolean;
  selectedYesPct: number;
  address: `0x${string}` | undefined;
  isConnected: boolean;
  yesStake: bigint | undefined;
  noStake: bigint | undefined;
  claimed: boolean | undefined;
  isOracle: boolean;
  amountStr: string;
  onAmountChange: (v: string) => void;
  amountError: string | null;
  tradeDisabled: boolean;
  needsApproval: boolean;
  onApprove: () => void;
  onBetYes: () => void;
  onBetNo: () => void;
  onResolve: (yes: boolean) => void;
  onClaim: () => void;
  fmt: (v: bigint | undefined) => string;
  outcomeLabel: (o: number) => string;
  txHash: `0x${string}` | undefined;
  txError: Error | null;
  isPending: boolean;
  confirming: boolean;
  confirmed: boolean;
};

function OddsBar({ yesPct }: { yesPct: number }) {
  const y = Math.min(100, Math.max(0, yesPct));
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="bg-[var(--pm-yes)] transition-[width] duration-300"
        style={{ width: `${y}%` }}
      />
      <div
        className="bg-[var(--pm-no)] transition-[width] duration-300"
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
    <div className={`bg-[#161b22] px-4 py-3 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6e7681]">
        {label}
      </p>
      <p
        className={`mt-1 break-all text-[13px] text-[#e6edf3] ${mono ? "font-mono text-[11px] leading-relaxed" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function PmTradePanel(p: Props) {
  const collateralDisplay =
    p.isEth || !p.collateralAddr || p.collateralAddr === zeroAddress
      ? "ETH"
      : p.collateralAddr;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--pm-border)] bg-[#161b22] shadow-2xl shadow-black/40 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
      <div className="shrink-0 border-b border-[var(--pm-border)] px-4 py-3">
        <p className="font-mono text-[10px] leading-relaxed text-[#6e7681]">
          <span className="text-[#8b949e]">Factory</span>{" "}
          <span className="break-all text-[#c9d1d9]">{p.factoryAddress}</span>
          <span className="mx-2 text-[#484f58]">·</span>
          {p.marketCountLabel}
          {p.blockLabel}
          <span className="mx-2 text-[#484f58]">·</span>
          <a
            className="text-[var(--pm-yes)] hover:underline"
            href="https://docs.risechain.com/docs/builders/testnet-details"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-[var(--pm-border)] px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                  p.tradingOpen
                    ? "bg-[var(--pm-yes)]/15 text-[var(--pm-yes)]"
                    : "bg-white/[0.06] text-[#8b949e]"
                }`}
              >
                {p.tradingOpen ? "Live" : "Closed"}
              </span>
              <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight text-white sm:text-[22px]">
                {p.question || "…"}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
                Yes price
              </p>
              <p className="text-[34px] font-semibold tabular-nums leading-none text-[var(--pm-yes)]">
                {p.selectedYesPct.toFixed(0)}¢
              </p>
              <p className="mt-1 text-[10px] text-[#6e7681]">Pool-weighted</p>
            </div>
          </div>
          <div className="mt-5">
            <OddsBar yesPct={p.selectedYesPct} />
            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[#8b949e]">
              <span>Yes {p.fmt(p.totalYes)}</span>
              <span>No {p.fmt(p.totalNo)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-[var(--pm-border)] sm:grid-cols-2">
          <PmStat label="Collateral" value={collateralDisplay} />
          <PmStat label="Outcome" value={p.outcomeLabel(p.outcomeNum)} />
          <PmStat
            label="Trading ends"
            value={
              p.tradingEndsAt != null
                ? new Date(Number(p.tradingEndsAt) * 1000).toLocaleString()
                : "…"
            }
          />
          <PmStat
            label="Claims open"
            value={
              p.claimsOpenAt != null && Number(p.claimsOpenAt) > 0
                ? new Date(Number(p.claimsOpenAt) * 1000).toLocaleString()
                : "—"
            }
          />
          <PmStat
            className="sm:col-span-2"
            label="Oracle"
            value={p.oracle ? String(p.oracle) : "…"}
            mono
          />
        </div>

        <div className="border-t border-[var(--pm-border)] px-4 py-4 sm:px-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
            Your position
          </p>
          <p className="mt-2 text-[13px] text-[#c9d1d9]">
            {!p.isConnected
              ? "Connect a wallet on RISE Testnet to trade."
              : `YES ${p.fmt(p.yesStake)} · NO ${p.fmt(p.noStake)} · Claimed ${String(p.claimed ?? false)}`}
          </p>
        </div>

        <div className="border-t border-[var(--pm-border)] bg-black/25 px-4 py-5 sm:px-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
            Trade
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-[11px] text-[#8b949e] sm:col-span-2">
              Amount ({p.isEth ? "ETH" : "token"})
              <input
                inputMode="decimal"
                autoComplete="off"
                className="rounded-xl border border-white/[0.1] bg-[#0d1117] px-4 py-3 text-[15px] text-white outline-none ring-[var(--pm-yes)]/30 focus:ring-2"
                value={p.amountStr}
                onChange={(e) => p.onAmountChange(e.target.value)}
              />
            </label>
            {p.amountError ? (
              <p className="text-[12px] text-[var(--pm-no)] sm:col-span-3">{p.amountError}</p>
            ) : null}
            {!p.isEth ? (
              <button
                type="button"
                onClick={p.onApprove}
                disabled={
                  !p.isConnected || p.isPending || p.confirming || !p.needsApproval
                }
                className="rounded-xl border border-white/[0.12] px-4 py-3 text-[13px] font-medium text-[#e6edf3] hover:bg-white/[0.04] disabled:opacity-40"
              >
                {p.needsApproval ? "Approve token" : "Approved"}
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={p.onBetYes}
              disabled={
                !p.isConnected ||
                !p.tradingOpen ||
                p.isPending ||
                p.confirming ||
                p.tradeDisabled
              }
              className="rounded-xl bg-[var(--pm-yes)] py-3.5 text-[14px] font-semibold text-[#0d1117] shadow-lg shadow-[var(--pm-yes)]/20 hover:brightness-110 disabled:opacity-40"
            >
              Buy Yes
            </button>
            <button
              type="button"
              onClick={p.onBetNo}
              disabled={
                !p.isConnected ||
                !p.tradingOpen ||
                p.isPending ||
                p.confirming ||
                p.tradeDisabled
              }
              className="rounded-xl bg-[#e85d5d] py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-[#e85d5d]/15 hover:brightness-110 disabled:opacity-40"
            >
              Buy No
            </button>
          </div>
        </div>

        {p.isOracle ? (
          <div className="border-t border-amber-500/25 bg-amber-500/[0.07] px-4 py-4 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
              Oracle
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
                disabled={p.tradingOpen || p.isPending || p.confirming}
                onClick={() => p.onResolve(true)}
              >
                Resolve YES
              </button>
              <button
                type="button"
                className="rounded-xl border border-amber-500/50 px-4 py-2.5 text-[13px] font-medium text-amber-100 hover:bg-amber-500/10 disabled:opacity-40"
                disabled={p.tradingOpen || p.isPending || p.confirming}
                onClick={() => p.onResolve(false)}
              >
                Resolve NO
              </button>
            </div>
            <p className="mt-2 text-[11px] text-amber-200/70">
              Available after the trading window ends.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--pm-border)] px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={p.onClaim}
            disabled={
              !p.isConnected ||
              !p.claimsReady ||
              Boolean(p.claimed) ||
              p.isPending ||
              p.confirming
            }
            className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-semibold text-[#0d1117] hover:bg-[#e6edf3] disabled:opacity-40"
          >
            Claim
          </button>
          {p.txHash ? (
            <a
              className="text-[11px] text-[var(--pm-yes)] hover:underline"
              href={`https://explorer.testnet.riselabs.xyz/tx/${p.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          ) : null}
          {p.txError ? (
            <p className="w-full text-[11px] text-[var(--pm-no)]">{p.txError.message}</p>
          ) : null}
          {p.isPending || p.confirming ? (
            <p className="w-full text-[11px] text-[#8b949e]">
              {p.isPending ? "Confirm in wallet…" : "Confirming…"}
            </p>
          ) : null}
          {p.confirmed ? (
            <p className="w-full text-[11px] text-[var(--pm-yes)]">Confirmed.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
