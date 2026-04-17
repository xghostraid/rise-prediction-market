"use client";

import { PmTopBar } from "./PmTopBar";

type Props = {
  factoryEnvInvalid: boolean;
  exampleUrl: string;
};

export function PmNoFactory({ factoryEnvInvalid, exampleUrl }: Props) {
  return (
    <div className="min-h-screen bg-[var(--pm-bg)]">
      <PmTopBar compact />
      <div className="mx-auto max-w-xl px-4 pb-20 pt-10 lg:pt-14">
        <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] p-8 shadow-2xl shadow-black/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--pm-yes)]">
            Setup
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Connect a MarketFactory
          </h1>
          {factoryEnvInvalid ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/95">
              <code className="text-[var(--pm-yes)]">NEXT_PUBLIC_MARKET_FACTORY</code> in{" "}
              <code className="text-white/90">.env.local</code> is not a valid address. Use the
              42‑character address from deploy logs, save, and restart{" "}
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
                <code className="mt-1 block break-all rounded-xl border border-[var(--pm-border)] bg-black/30 px-3 py-2 text-xs text-[#8b949e]">
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
              forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet.riselabs.xyz
              --broadcast
            </code>
          </div>
          <p className="mt-6 text-xs text-[#6e7681]">
            <a
              className="text-[var(--pm-yes)] hover:underline"
              href="https://docs.risechain.com/docs/builders/testnet-details"
              target="_blank"
              rel="noreferrer"
            >
              RISE testnet
            </a>
            {" · "}
            WalletConnect if{" "}
            <code className="rounded bg-white/[0.06] px-1">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code>{" "}
            is set (
            <a
              className="text-[var(--pm-yes)] hover:underline"
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
