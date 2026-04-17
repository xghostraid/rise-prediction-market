"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "rise-markets-watchlist-v1";

function load(): `0x${string}`[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is `0x${string}` => typeof x === "string" && x.startsWith("0x"));
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [list, setList] = useState<`0x${string}`[]>([]);

  useEffect(() => {
    setList(load());
  }, []);

  const persist = useCallback((next: `0x${string}`[]) => {
    setList(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (addr: `0x${string}`) => {
      const lower = addr.toLowerCase();
      const has = list.some((a) => a.toLowerCase() === lower);
      if (has) {
        persist(list.filter((a) => a.toLowerCase() !== lower));
      } else {
        persist([...list, addr]);
      }
    },
    [list, persist],
  );

  const has = useCallback(
    (addr: `0x${string}`) => list.some((a) => a.toLowerCase() === addr.toLowerCase()),
    [list],
  );

  return { list, toggle, has };
}
