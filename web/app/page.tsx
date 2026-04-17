import { Suspense } from "react";
import { MarketApp } from "@/components/MarketApp";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--pm-bg)]">
      <Suspense
        fallback={
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0d1117] text-[#8b949e]">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-gradient-to-br from-[#00d395] to-[#00996a]" />
            <p className="text-sm">Loading markets…</p>
          </div>
        }
      >
        <MarketApp />
      </Suspense>
    </div>
  );
}
