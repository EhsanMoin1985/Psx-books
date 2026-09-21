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

-- Current holdings on a moving weighted average cost, marked to the latest
-- stored price.
--
-- Cost has to be walked trade by trade, not averaged over every purchase ever
-- made: once a symbol has been bought, partly sold and bought again, only the
-- cost still attaching to the units on hand may be carried. Units held before
-- the books open carry no cost, so they are excluded from the average and
-- their disposals relieve none.
create view holdings as
with recursive ordered as (
  select owner, symbol, type, qty, amount,
         row_number() over (partition by owner, symbol order by trade_date, created_at) as rn
  from transactions
  where symbol is not null and qty is not null and type in ('BUY','SELL')
), running as (
  select owner, symbol, rn,
         sum(case when type = 'BUY' then qty else -qty end)
           over (partition by owner, symbol order by rn) as pos
  from ordered
), opening as (
  -- The deepest the running quantity goes below zero is what must have been
  -- held before the first row in the data.
  select owner, symbol, greatest(0, -min(pos)) as open_qty
  from running group by owner, symbol
), walk as (
  select o.owner, o.symbol, o.rn,
         op.open_qty + case when o.type = 'BUY' then o.qty else -o.qty end as qty,
         case when o.type = 'BUY' then -o.amount else 0::numeric end as cost,
         case when o.type = 'BUY' then op.open_qty
              else greatest(op.open_qty - o.qty, 0) end as open_left
  from ordered o
  join opening op on op.owner = o.owner and op.symbol = o.symbol
  where o.rn = 1
  union all
  select o.owner, o.symbol, o.rn,
         w.qty + case when o.type = 'BUY' then o.qty else -o.qty end,
         case
           when o.type = 'BUY' then w.cost - o.amount
           else w.cost - round(
             case when w.qty - w.open_left > 0
                  then w.cost / (w.qty - w.open_left)
                       * greatest(o.qty - least(w.open_left, o.qty), 0)
                  else 0 end, 2)
         end,
         case when o.type = 'BUY' then w.open_left
              else greatest(w.open_left - o.qty, 0) end
  from walk w
  join ordered o
    on o.owner = w.owner and o.symbol = w.symbol and o.rn = w.rn + 1
), final as (
  select distinct on (owner, symbol) owner, symbol, qty, cost, open_left
  from walk order by owner, symbol, rn desc
), latest as (
  select distinct on (owner, symbol) owner, symbol, close, as_of
  from prices order by owner, symbol, as_of desc
)
select f.owner, f.symbol, f.qty,
       f.open_left as opening_qty,          -- units on hand that carry no cost
       f.cost,
       case when f.qty > 0 then f.cost / f.qty end as avg_cost,
       l.close, l.as_of,
       case when l.close is not null then round(l.close * f.qty, 2) end as market_value,
       case when l.close is not null then round(l.close * f.qty - f.cost, 2) end as unrealised
from final f
left join latest l on l.owner = f.owner and l.symbol = f.symbol
where f.qty > 0;
