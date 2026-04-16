import { Suspense } from "react";
import { MarketApp } from "@/components/MarketApp";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0e11]">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-[#8b949e]">
            Loading…
          </div>
        }
      >
        <MarketApp />
      </Suspense>
    </div>
  );
}
