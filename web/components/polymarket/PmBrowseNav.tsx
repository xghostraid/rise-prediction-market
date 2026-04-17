"use client";

import { BROWSE_SORT_TABS, type BrowseSortId } from "@/lib/marketUtils";

type Props = {
  active: BrowseSortId;
  onChange: (id: BrowseSortId) => void;
};

export function PmBrowseNav({ active, onChange }: Props) {
  return (
    <div className="border-b border-[var(--pm-border)] bg-[var(--pm-bg)]">
      <div className="mx-auto max-w-[1320px] px-3">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto py-2">
          {BROWSE_SORT_TABS.map((tab, i) => {
            const isActive = active === tab.id;
            return (
              <div key={tab.id} className="flex shrink-0 items-center">
                {i > 0 ? (
                  <span className="px-1.5 text-[13px] text-[#484f58]" aria-hidden>
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onChange(tab.id)}
                  className={`shrink-0 rounded-md px-2 py-1.5 text-[13px] font-semibold transition ${
                    isActive ? "text-white" : "text-[#8b949e] hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
