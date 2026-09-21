-- PSX Books: Supabase schema (Postgres). Run once in the SQL editor of a new project.
-- Single-owner design: every row belongs to auth.uid(), enforced by row level security.

create table transactions (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null default auth.uid() references auth.users on delete cascade,
  trade_date   date not null,
  type         text not null check (type in ('OPEN','BUY','SELL','DEPOSIT','WITHDRAWAL','DIVIDEND','MARKUP','CGT','FEE')),
  symbol       text,
  qty          numeric(18,4),
  price        numeric(18,4),
  commission   numeric(18,2) default 0,
  amount       numeric(18,2) not null,          -- signed net amount as per broker statement
  gross        numeric(18,2),                   -- dividends: before withholding tax
  stmt_balance numeric(18,2),                   -- broker running balance, for reconciliation
  external     boolean not null default false,  -- true = settled outside the broker account (bank dividend)
  voucher      text,
  note         text,
  source       text,
  created_at   timestamptz not null default now()
);
create index on transactions (owner, trade_date);

create table prices (                            -- one row per symbol per day, written by the scheduled job
  owner       uuid not null default auth.uid() references auth.users on delete cascade,
  symbol      text not null,
  as_of       date not null,
  close       numeric(18,4) not null,
  last_trade  numeric(18,4),
  source      text,
  fetched_at  timestamptz not null default now(),
  primary key (owner, symbol, as_of)
);

create table watchlist (
  owner      uuid not null default auth.uid() references auth.users on delete cascade,
  symbol     text not null,
  target_buy  numeric(18,4),
  target_sell numeric(18,4),
  note       text,
  primary key (owner, symbol)
);

create table alerts (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users on delete cascade,
  symbol     text not null,
  direction  text not null check (direction in ('above','below')),
  level      numeric(18,4) not null,
  active     boolean not null default true,
  fired_at   timestamptz
);

create table plans (                             -- trade planner: intended orders, before execution in JS
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users on delete cascade,
  symbol      text not null,
  side        text not null check (side in ('BUY','SELL')),
  qty         numeric(18,4) not null,
  limit_price numeric(18,4),
  rationale   text,
  status      text not null default 'draft' check (status in ('draft','placed','filled','cancelled')),
  created_at  timestamptz not null default now(),
  linked_txn  uuid references transactions on delete set null
);

create table settings (                          -- fx rate, broker quantities, statement totals, opening prices,
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  data  jsonb not null default '{}'::jsonb       -- dashboard layout, saved views: one JSON document
);

alter table transactions enable row level security;
alter table prices       enable row level security;
alter table watchlist    enable row level security;
alter table alerts       enable row level security;
alter table plans        enable row level security;
alter table settings     enable row level security;

do $$ declare t text;
begin
  foreach t in array array['transactions','prices','watchlist','alerts','plans','settings'] loop
    execute format('create policy owner_all on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- Current holdings, weighted average cost, marked to the latest stored price.
create view holdings as
with moves as (
  select owner, symbol,
         sum(case when type='BUY' then qty when type='SELL' then -qty else 0 end) as qty,
         sum(case when type='BUY' then -amount when type='SELL' then 0 else 0 end) as buy_cost,
         sum(case when type='BUY' then qty else 0 end) as bought
  from transactions where symbol is not null group by owner, symbol
), latest as (
  select distinct on (owner, symbol) owner, symbol, close, as_of
  from prices order by owner, symbol, as_of desc
)
select m.owner, m.symbol, m.qty,
       case when m.bought > 0 then m.buy_cost / m.bought * m.qty end as cost,
       l.close, l.as_of,
       case when l.close is not null then l.close * m.qty end as market_value
from moves m left join latest l on l.owner = m.owner and l.symbol = m.symbol
where m.qty > 0;
