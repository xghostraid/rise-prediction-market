export function registerApi(app, db) {
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.get("/markets", async (_req, res) => {
        const rows = await db `
      select
        address, collateral, oracle, trading_ends_at::text, claim_delay_after_resolve::text,
        question, created_block::text
      from markets
      order by created_block desc
      limit 500
    `;
        res.json({ markets: rows });
    });
    app.get("/markets/:address/events", async (req, res) => {
        const address = String(req.params.address || "").toLowerCase();
        const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
        const fromId = req.query.fromId != null ? Number(req.query.fromId) : null;
        const rows = await db `
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
    app.get("/orderbook/:address", async (req, res) => {
        const market = String(req.params.address || "").toLowerCase();
        // Group open orders by (side, price)
        const rows = await db `
      select side, price, sum(size_remaining)::text as size
      from orderbook_orders
      where market = ${market} and size_remaining > 0
      group by side, price
      order by side asc, price asc
    `;
        res.json({ levels: rows });
    });
    app.get("/orderbook/:address/orders", async (req, res) => {
        const market = String(req.params.address || "").toLowerCase();
        const maker = req.query.maker ? String(req.query.maker).toLowerCase() : null;
        const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
        const rows = await db `
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
    app.get("/trades/:address", async (req, res) => {
        const market = String(req.params.address || "").toLowerCase();
        const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
        const rows = await db `
      select block_number::text, tx_hash, log_index, kind, amount::text, user_addr
      from market_events
      where market = ${market} and kind = 'Trade'
      order by block_number desc, log_index desc
      limit ${limit}
    `;
        res.json({ trades: rows });
    });
}
