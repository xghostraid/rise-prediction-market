export type IndexerMarket = {
  address: string;
  market_type: "pool" | "orderbook" | string;
  collateral: string;
  oracle: string;
  trading_ends_at: string;
  claim_delay_after_resolve: string;
  question: string;
  created_block: string;
};

export type IndexerEvent = {
  id: string;
  market: string;
  block_number: string;
  tx_hash: string;
  log_index: number;
  kind: "BetYes" | "BetNo" | "Claimed" | "Resolved" | string;
  user_addr: string | null;
  amount: string | null;
  outcome: number | null;
  claims_open_at: string | null;
};

export type IndexerOrder = {
  order_id: string;
  maker: string;
  side: number;
  price: number;
  size_remaining: string;
  created_block: string;
  created_tx: string;
};

export type IndexerLevel = { side: number; price: number; size: string };

function baseUrl() {
  const raw = process.env.NEXT_PUBLIC_INDEXER_URL?.trim();
  return raw && raw.length ? raw.replace(/\/$/, "") : null;
}

export function hasIndexer(): boolean {
  return baseUrl() != null;
}

export async function indexerFetchMarkets(): Promise<IndexerMarket[] | null> {
  const b = baseUrl();
  if (!b) return null;
  const r = await fetch(`${b}/markets`, { cache: "no-store" });
  if (!r.ok) throw new Error(`indexer /markets ${r.status}`);
  const j = (await r.json()) as { markets: IndexerMarket[] };
  return j.markets ?? [];
}

export async function indexerFetchMarketEvents(
  market: `0x${string}`,
  opts?: { limit?: number; fromId?: string },
): Promise<IndexerEvent[] | null> {
  const b = baseUrl();
  if (!b) return null;
  const p = new URLSearchParams();
  if (opts?.limit) p.set("limit", String(opts.limit));
  if (opts?.fromId) p.set("fromId", String(opts.fromId));
  const r = await fetch(`${b}/markets/${market}/events?${p.toString()}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`indexer events ${r.status}`);
  const j = (await r.json()) as { events: IndexerEvent[] };
  return j.events ?? [];
}

export async function indexerFetchOrderbookLevels(
  market: `0x${string}`,
): Promise<IndexerLevel[] | null> {
  const b = baseUrl();
  if (!b) return null;
  const r = await fetch(`${b}/orderbook/${market}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`indexer orderbook ${r.status}`);
  const j = (await r.json()) as { levels: IndexerLevel[] };
  return j.levels ?? [];
}

export async function indexerFetchOrderbookOrders(
  market: `0x${string}`,
  opts?: { limit?: number; maker?: `0x${string}` },
): Promise<IndexerOrder[] | null> {
  const b = baseUrl();
  if (!b) return null;
  const p = new URLSearchParams();
  if (opts?.limit) p.set("limit", String(opts.limit));
  if (opts?.maker) p.set("maker", String(opts.maker));
  const r = await fetch(`${b}/orderbook/${market}/orders?${p.toString()}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`indexer orderbook orders ${r.status}`);
  const j = (await r.json()) as { orders: IndexerOrder[] };
  return j.orders ?? [];
}

