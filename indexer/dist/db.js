import postgres from "postgres";
export function connectDb(databaseUrl) {
    return postgres(databaseUrl, {
        max: 10,
        prepare: false,
    });
}
export async function migrate(db) {
    await db /* sql */ `
    create table if not exists cursor (
      key text primary key,
      value text not null
    );
  `;
    await db /* sql */ `
    create table if not exists markets (
      address text primary key,
      market_type text not null default 'pool',
      created_block bigint not null,
      created_tx text not null,
      factory_id numeric not null,
      collateral text not null,
      oracle text not null,
      trading_ends_at bigint not null,
      claim_delay_after_resolve bigint not null,
      question text not null
    );
  `;
    // Backfill market_type for existing rows (if table pre-existed).
    await db /* sql */ `
    alter table markets
      add column if not exists market_type text not null default 'pool';
  `;
    await db /* sql */ `
    create table if not exists market_events (
      id bigserial primary key,
      market text not null references markets(address) on delete cascade,
      block_number bigint not null,
      tx_hash text not null,
      log_index int not null,
      kind text not null,
      user_addr text null,
      amount numeric null,
      outcome int null,
      claims_open_at bigint null,
      unique (tx_hash, log_index)
    );
  `;
    await db /* sql */ `
    create index if not exists market_events_market_block_idx
    on market_events (market, block_number, log_index);
  `;
    await db /* sql */ `
    create table if not exists orderbook_orders (
      market text not null references markets(address) on delete cascade,
      order_id numeric not null,
      maker text not null,
      side int not null,
      price int not null,
      size_remaining numeric not null,
      created_block bigint not null,
      created_tx text not null,
      primary key (market, order_id)
    );
  `;
    await db /* sql */ `
    create index if not exists orderbook_orders_market_price_idx
    on orderbook_orders (market, side, price);
  `;
}
export async function getCursor(db, key) {
    const rows = await db `select value from cursor where key = ${key}`;
    return rows[0]?.value ?? null;
}
export async function setCursor(db, key, value) {
    await db `
    insert into cursor (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value
  `;
}
