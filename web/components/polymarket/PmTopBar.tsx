"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function PmTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--pm-border)] bg-[#0d1117]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#00d395] to-[#00996a] text-sm font-bold text-[#0d1117]">
            R
          </div>
          <div>
            <p className="text-[17px] font-semibold tracking-tight text-white">RISE</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b949e]">
              Prediction markets
            </p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-[14px] font-medium text-[#8b949e] md:flex">
          <span className="cursor-default text-white">Markets</span>
          <a
            className="hover:text-white"
            href="https://docs.risechain.com/docs/builders/testnet-details"
            target="_blank"
            rel="noreferrer"
          >
            RISE testnet
          </a>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
