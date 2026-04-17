import type { Db } from "./db.js";
import type { Request, Response } from "express";

export function registerApi(app: import("express").Express, db: Db) {
  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/markets", async (_req: Request, res: Response) => {
    const rows = await db<
      {
        address: string;
        market_type: string;
        collateral: string;
        oracle: string;
        trading_ends_at: string;
        claim_delay_after_resolve: string;
        question: string;
        created_block: string;
      }[]
    >`
      select
        address, market_type, collateral, oracle, trading_ends_at::text, claim_delay_after_resolve::text,
        question, created_block::text
      from markets
      order by created_block desc, address asc
      limit 5000
    `;
    res.json({ markets: rows });
  });

  app.get("/markets/:address/events", async (req: Request, res: Response) => {
    const address = String(req.params.address || "").toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
    const fromId = req.query.fromId != null ? Number(req.query.fromId) : null;

    const rows = await db<
      {
        id: string;
        market: string;
        block_number: string;
        tx_hash: string;
        log_index: number;
        kind: string;
        user_addr: string | null;
        amount: string | null;
        outcome: number | null;
        claims_open_at: string | null;
      }[]
    >`
      select
        id::text, market, block_number::text, tx_hash, log_index, kind, user_addr,
        amount::text, outcome, claims_open_at::text
      from market_events
      where market = ${address}
        and (${fromId}::bigint is null or id > ${fromId}::bigint)
      order by id asc
      limit ${limit}
    `;

    res.json({ events: rows });
  });

  app.get("/orderbook/:address", async (req: Request, res: Response) => {
    const market = String(req.params.address || "").toLowerCase();
    // Group open orders by (side, price)
    const rows = await db<
      { side: number; price: number; size: string }[]
    >`
      select side, price, sum(size_remaining)::text as size
      from orderbook_orders
      where market = ${market} and size_remaining > 0
      group by side, price
      order by side asc, price asc
    `;
    res.json({ levels: rows });
  });

  app.get("/orderbook/:address/orders", async (req: Request, res: Response) => {
    const market = String(req.params.address || "").toLowerCase();
    const maker = req.query.maker ? String(req.query.maker).toLowerCase() : null;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
    const rows = await db<
      {
        order_id: string;
        maker: string;
        side: number;
        price: number;
        size_remaining: string;
        created_block: string;
        created_tx: string;
      }[]
    >`
      select
        order_id::text,
        maker,
        side,
        price,
        size_remaining::text,
        created_block::text,
        created_tx
      from orderbook_orders
      where market = ${market}
        and size_remaining > 0
        and (${maker}::text is null or maker = ${maker})
      order by created_block desc, order_id desc
      limit ${limit}
    `;
    res.json({ orders: rows });
  });

  app.get("/trades/:address", async (req: Request, res: Response) => {
    const market = String(req.params.address || "").toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
    const rows = await db<
      { block_number: string; tx_hash: string; log_index: number; kind: string; amount: string | null; user_addr: string | null }[]
    >`
      select block_number::text, tx_hash, log_index, kind, amount::text, user_addr
      from market_events
      where market = ${market} and kind = 'Trade'
      order by block_number desc, log_index desc
      limit ${limit}
    `;
    res.json({ trades: rows });
  });
}

