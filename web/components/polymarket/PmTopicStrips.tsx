"use client";

import {
  PM_CATEGORIES,
  PM_QUICK_TAGS,
  type PmCategory,
} from "@/lib/marketUtils";

type Props = {
  category: PmCategory;
  onCategoryChange: (c: PmCategory) => void;
  activeQuickTag: string | null;
  onQuickTag: (tag: string) => void;
};

export function PmTopicStrips({
  category,
  onCategoryChange,
  activeQuickTag,
  onQuickTag,
}: Props) {
  return (
    <div className="border-b border-[var(--pm-border)] bg-[var(--pm-bg)]">
      {/* Topics — polymarket.com “Topics” row */}
      <div className="mx-auto max-w-[1320px] px-2 pt-2">
        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6e7681]">
          Topics
        </p>
        <div className="no-scrollbar flex gap-1 overflow-x-auto pb-2 pl-1 pr-4">
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
                {c === "All" ? "All" : c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trending / quick tags — polymarket.com second strip */}
      <div className="mx-auto max-w-[1320px] border-t border-[var(--pm-border)] px-2 pt-2">
        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6e7681]">
          Trending
        </p>
        <div className="no-scrollbar flex gap-1 overflow-x-auto pb-2 pl-1 pr-4">
          {PM_QUICK_TAGS.map((tag) => {
            const active = activeQuickTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onQuickTag(tag)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  active
                    ? "bg-white/[0.12] text-white"
                    : "bg-transparent text-[#8b949e] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
