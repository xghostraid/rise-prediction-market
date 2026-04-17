"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useRef, useState } from "react";

export type PmAppView = "browse" | "portfolio" | "activity";

type Props = {
  /** Setup / error pages: only logo row + wallet */
  compact?: boolean;
  appView?: PmAppView;
  onAppViewChange?: (v: PmAppView) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
};

const MENU: { id: PmAppView; label: string }[] = [
  { id: "browse", label: "Markets" },
  { id: "portfolio", label: "Portfolio" },
  { id: "activity", label: "Activity" },
];

export function PmTopBar({
  compact = false,
  appView = "browse",
  onAppViewChange,
  search = "",
  onSearchChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  const appViewLabel = useMemo(() => {
    return MENU.find((m) => m.id === appView)?.label ?? "Markets";
  }, [appView]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pm-border)] bg-[var(--pm-bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-2 px-4 py-3 lg:px-5">
        <a href="/" className="group flex shrink-0 items-center gap-2.5 no-underline">
          <PmLogoMark />
          <span className="text-[19px] font-bold tracking-tight">
            <span className="text-[var(--rise-primary)]">RISE</span>
            <span className="font-semibold text-[#8b949e]">markets</span>
          </span>
        </a>

        {!compact && appView === "browse" && onSearchChange ? (
          <div className="hidden min-w-0 flex-1 items-center px-3 sm:flex">
            <div className="relative w-full max-w-[620px]">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e7681]">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Search markets"
                autoComplete="off"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-full border border-[var(--pm-border)] bg-[var(--pm-surface)] py-2.5 pl-10 pr-4 text-[14px] text-white placeholder:text-[#6e7681] outline-none ring-[var(--pm-yes)]/20 focus:ring-2"
              />
            </div>
          </div>
        ) : !compact ? (
          <div className="hidden min-w-0 flex-1 items-center justify-center px-3 text-[12px] text-[#6e7681] sm:flex">
            Markets on RISE testnet
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2" ref={rootRef}>
          {!compact && onAppViewChange ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--pm-border)] bg-[var(--pm-surface)] px-3 py-2 text-[13px] font-semibold text-[#c9d1d9] hover:bg-[var(--pm-surface-2)]"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                {appViewLabel}
                <span className="text-[#6e7681]" aria-hidden>
                  ▾
                </span>
              </button>
              {open ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface)] shadow-2xl shadow-black/60"
                >
                  {MENU.map((item) => {
                    const active = item.id === appView;
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          onAppViewChange(item.id);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-semibold transition ${
                          active
                            ? "bg-white/[0.05] text-white"
                            : "text-[#c9d1d9] hover:bg-white/[0.04]"
                        }`}
                      >
                        {item.label}
                        {active ? (
                          <span className="text-[var(--rise-primary)]" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="shrink-0 [&_button]:!rounded-full [&_button]:!font-semibold">
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0-2a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"
        fill="currentColor"
      />
      <path
        d="M15.446 15.446 20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
