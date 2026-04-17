"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PM_CATEGORIES, type PmCategory } from "@/lib/marketUtils";

type Props = {
  category: PmCategory;
  onCategoryChange: (c: PmCategory) => void;
};

export function PmTopBar({ category, onCategoryChange }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pm-border)] bg-[var(--pm-bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-3 lg:px-5">
        <a href="/" className="group flex shrink-0 items-center gap-2.5 no-underline">
          <PmLogoMark />
          <span className="text-[19px] font-bold tracking-tight">
            <span className="text-[var(--rise-primary)]">RISE</span>
            <span className="font-semibold text-[#8b949e]">markets</span>
          </span>
        </a>

        <div className="hidden min-w-0 flex-1 justify-center px-6 md:flex">
          <nav className="flex items-center gap-1 text-[13px] font-medium text-[#8b949e]">
            <span className="rounded-md px-2 py-1 text-white">Markets</span>
            <span className="text-[var(--pm-border)]">|</span>
            <a
              className="rounded-md px-2 py-1 hover:text-white"
              href="https://docs.risechain.com/docs/builders/testnet-details"
              target="_blank"
              rel="noreferrer"
            >
              RISE testnet
            </a>
          </nav>
        </div>

        <div className="shrink-0 [&_button]:!rounded-full [&_button]:!font-semibold">
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </div>

      {/* Category rail */}
      <div className="border-t border-[var(--pm-border)] bg-[var(--pm-bg)]">
        <div className="mx-auto max-w-[1320px] px-2">
          <div className="no-scrollbar flex gap-1 overflow-x-auto py-2 pl-2 pr-4">
            {PM_CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCategoryChange(c)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    active
                      ? "bg-[var(--rise-primary)] text-[#0b0e11]"
                      : "bg-transparent text-[#8b949e] hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

function PmLogoMark() {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-lg shadow-lg shadow-[#00d395]/25"
      style={{
        background: "linear-gradient(145deg, #00e5a3 0%, #00d395 40%, #00a87a 100%)",
      }}
      aria-hidden
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
        <path
          d="M12 2L20 7V17L12 22L4 17V7L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
