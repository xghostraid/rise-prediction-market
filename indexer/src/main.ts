import express from "express";
import { loadConfig } from "./config.js";
import { connectDb, migrate } from "./db.js";
import { indexOnce } from "./indexer.js";
import { registerApi } from "./api.js";

async function main() {
  const cfg = loadConfig();
  const db = connectDb(cfg.DATABASE_URL);
  await migrate(db);

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerApi(app, db);

  app.listen(cfg.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[indexer] listening on :${cfg.PORT}`);
  });

  // Basic loop: run once immediately, then every 10s.
  async function tick() {
    try {
      const r = await indexOnce({
        rpcUrl: cfg.RISE_RPC,
        factory: cfg.FACTORY_ADDRESS,
        orderbookFactory: cfg.ORDERBOOK_FACTORY_ADDRESS,
        db,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[indexer] head=${r.head} markets=${r.markets} insertedEvents=${r.events}`,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[indexer] tick error", e);
    }
  }

  await tick();
  setInterval(tick, 10_000);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

