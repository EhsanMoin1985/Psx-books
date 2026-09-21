#!/usr/bin/env bash
# Proves the `holdings` view in schema.sql gives the same cost as the
# TypeScript engine, so ad-hoc SQL can never contradict the screens.
#
# Needs a local Postgres 16 (psql, initdb, pg_ctl on PATH) and nothing else.
# Run from the repository root:  ./scripts/verify-view.sh
set -euo pipefail

# Debian and Ubuntu keep the server binaries off PATH.
for d in /usr/lib/postgresql/*/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done
export PATH
for bin in psql initdb pg_ctl; do
  command -v "$bin" >/dev/null || { echo "$bin not found. Install PostgreSQL 16 and retry." >&2; exit 1; }
done
# initdb refuses to run as root, so drop to an unprivileged user when needed.
if [ "$(id -u)" = 0 ]; then
  echo "Run this as an unprivileged user: initdb refuses to run as root." >&2
  exit 1
fi

DIR="${TMPDIR:-/tmp}/psx-view-check"
PORT="${PGPORT_CHECK:-55432}"
OWNER=00000000-0000-0000-0000-000000000001

cleanup() { pg_ctl -D "$DIR/data" stop >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$DIR"; mkdir -p "$DIR/data"
initdb -D "$DIR/data" -U postgres -A trust >/dev/null
# Unix socket only, so the check never collides with a Postgres already running.
pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
sleep 2

PG="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PG -c "create database psx" postgres >/dev/null

# Supabase supplies auth.users and auth.uid(); stub them so schema.sql runs unchanged.
$PG -d psx <<'SQL' >/dev/null
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
SQL

$PG -d psx -f schema.sql >/dev/null
echo "schema.sql applied cleanly"

node -e '
const d = require("./psx-books-data.json");
const q = s => s == null ? "null" : "'"'"'" + String(s).replace(/'"'"'/g, "'"'"''"'"'") + "'"'"'";
const owner = q(process.argv[1]);
const rows = d.transactions.slice().sort((a,b)=>a.seq-b.seq).map((t,i)=>
  `(${owner},${q(t.date)},${q(t.type)},${q(t.symbol)},${t.qty??"null"},${t.price??"null"},${t.comm??0},${t.amount},${t.gross??"null"},${t.stmtBalance??"null"},${t.external?"true":"false"},${q(new Date(Date.UTC(2020,0,1)+i*1000).toISOString())})`);
const px = d.settings.prices.px, asOf = d.settings.prices.asOf;
const prices = Object.entries(px).map(([s,c]) => `(${owner},${q(s)},${q(asOf[s])},${c})`);
console.log(`insert into auth.users(id) values (${owner});
insert into transactions(owner,trade_date,type,symbol,qty,price,commission,amount,gross,stmt_balance,external,created_at) values ${rows.join(",")};
insert into prices(owner,symbol,as_of,close) values ${prices.join(",")};`);
' "$OWNER" > "$DIR/load.sql"

$PG -d psx -f "$DIR/load.sql" >/dev/null
echo "seed data loaded"

$PG -d psx -tAc \
  "select symbol||','||round(cost,2)||','||round(qty,0) from holdings order by symbol;" \
  | sed '/^$/d' > "$DIR/holdings.csv"

echo "view output:"
sed 's/^/  /' "$DIR/holdings.csv"

VIEW_CSV="$DIR/holdings.csv" npx vitest run tests/view-compare.test.ts
