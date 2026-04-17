"use client";

export function PmFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--pm-border)] bg-[var(--pm-bg)] py-10">
      <div className="mx-auto max-w-[1320px] px-4 lg:px-5">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div>
            <p className="text-[15px] font-bold text-white">
              <span className="text-[var(--rise-primary)]">RISE</span>
              <span className="text-[#8b949e]">markets</span>
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#8b949e]">
              Binary prediction markets on RISE testnet. Pool-weighted prices; oracle resolves;
              claims on-chain.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 text-[13px]">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e7681]">
                Build
              </p>
              <a
                className="block text-[#c9d1d9] hover:text-[var(--rise-primary)]"
                href="https://docs.risechain.com/"
                target="_blank"
                rel="noreferrer"
              >
                Docs
              </a>
              <a
                className="block text-[#c9d1d9] hover:text-[var(--rise-primary)]"
                href="https://docs.risechain.com/docs/builders/testnet-details"
                target="_blank"
                rel="noreferrer"
              >
                Testnet
              </a>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e7681]">
                Network
              </p>
              <a
                className="block text-[#c9d1d9] hover:text-[var(--rise-primary)]"
                href="https://portal.risechain.com/"
                target="_blank"
                rel="noreferrer"
              >
                Portal
              </a>
              <a
                className="block text-[#c9d1d9] hover:text-[var(--rise-primary)]"
                href="https://explorer.testnet.riselabs.xyz/"
                target="_blank"
                rel="noreferrer"
              >
                Explorer
              </a>
            </div>
          </div>
        </div>
        <p className="mt-10 text-[12px] text-[#6e7681]">
          UI layout inspired by public prediction-market browse patterns. This app is an
          independent demo; not affiliated with Polymarket.
        </p>
      </div>
    </footer>
  );
}
