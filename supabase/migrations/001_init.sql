-- ============================================================================
-- BMONI Embedded — Supabase schema (Phase 0 entity list → real DDL)
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- (or `supabase db push` with the CLI).
--
-- Design rules honoured here:
--   · RLS enabled on EVERY table — rows are scoped to auth.uid().
--   · The ledger is the source of truth: balances and transactions are
--     projected from ledger_entries via views, never stored redundantly.
--   · The anon key (browser) can only touch the current user's rows.
--     The service role key belongs to the Phase 2 FastAPI backend only —
--     it is intentionally NOT required by anything in this migration.
--   · sessions are managed by Supabase Auth (no table by design).
--   · kyc_verifications / kyc_events / funding_attempts are folded into
--     their parent row as a jsonb `events` timeline during Phases 1–8;
--     they can be normalised into tables later without a breaking change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users → profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  email      text not null,
  phone      text not null default '',
  status     text not null default 'ACTIVE' check (status in ('ACTIVE', 'RESTRICTED')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- wallets + wallet_balances (projected)
-- ---------------------------------------------------------------------------
create table public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  currency   text not null default 'USD',
  status     text not null default 'ACTIVE' check (status in ('ACTIVE', 'FROZEN')),
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  ts_ms        bigint not null,
  description  text not null,
  counterparty text not null default '',
  amount_cents bigint not null,
  type         text not null check (type in ('CREDIT', 'DEBIT', 'FEE', 'RESERVE', 'RELEASE')),
  status       text not null check (status in ('POSTED', 'PENDING', 'RELEASED')),
  ref_kind     text not null check (ref_kind in ('FUNDING', 'TRANSFER', 'ADJUSTMENT')),
  ref_id       text not null
);
create index ledger_entries_user_ts_idx on public.ledger_entries (user_id, ts_ms desc);

-- balances are *projected* from the ledger — available = posted − active reserves
create view public.wallet_balances with (security_invoker = on) as
select
  user_id,
  coalesce(sum(case when status = 'POSTED' then amount_cents else 0 end), 0)
    - coalesce(sum(case when type = 'RESERVE' and status = 'PENDING' then -amount_cents else 0 end), 0)
    as available_cents,
  coalesce(sum(case when type = 'RESERVE' and status = 'PENDING' then -amount_cents else 0 end), 0)
    as pending_cents
from public.ledger_entries
group by user_id;

-- transaction rollup, grouped by ref_id (one funding intent / transfer = 1..n entries)
create view public.transactions with (security_invoker = on) as
select
  user_id,
  ref_id        as id,
  min(ts_ms)    as ts_ms,
  max(ref_kind) as ref_kind,
  sum(case when type <> 'FEE' then amount_cents else 0 end) as gross_cents,
  -sum(case when type = 'FEE' then amount_cents else 0 end) as fee_cents
from public.ledger_entries
group by user_id, ref_id;

-- ---------------------------------------------------------------------------
-- kyc
-- ---------------------------------------------------------------------------
create table public.kyc_profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  status        text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED','IN_PROGRESS','PENDING','VERIFIED','REJECTED','RETRY_REQUIRED','EXPIRED')),
  attempts      integer not null default 0,
  personal_info jsonb,
  document_type text check (document_type is null or document_type in ('PASSPORT','DRIVERS_LICENSE','NATIONAL_ID')),
  reason        text,
  events        jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rails + beneficiaries
-- ---------------------------------------------------------------------------
create table public.rail_accounts (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  rail            text not null check (rail in ('SEPA','ACH','FPS','WIRE')),
  institution     text not null,
  account_masked  text not null,
  status          text not null default 'VALIDATING'
    check (status in ('VALIDATING','ACTIVE','FAILED','DEACTIVATED')),
  fail_reason     text,
  added_at_ms     bigint not null,
  events          jsonb not null default '[]'::jsonb
);
create index rail_accounts_user_idx on public.rail_accounts (user_id);

create table public.beneficiaries (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  rail            text not null check (rail in ('SEPA','ACH','FPS','WIRE')),
  account_masked  text not null,
  institution     text not null,
  status          text not null default 'PENDING'
    check (status in ('PENDING','VERIFIED','REJECTED','DEACTIVATED')),
  fail_reason     text,
  created_at_ms   bigint not null,
  events          jsonb not null default '[]'::jsonb
);
create index beneficiaries_user_idx on public.beneficiaries (user_id);

-- ---------------------------------------------------------------------------
-- funding + money movement
-- ---------------------------------------------------------------------------
create table public.funding_intents (
  id               text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  method           text not null check (method in ('CARD','BANK_TRANSFER','OPEN_BANKING')),
  amount_cents     bigint not null,
  fee_cents        bigint not null default 0,
  status           text not null default 'CREATED'
    check (status in ('CREATED','REQUIRES_ACTION','PROCESSING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  fail_reason      text,
  provider_ref     text not null,
  reference_code   text,
  idempotency_key  text,
  created_at_ms    bigint not null,
  events           jsonb not null default '[]'::jsonb
);
create index funding_intents_user_idx on public.funding_intents (user_id, created_at_ms desc);

-- transfers + withdrawals + internal transfers share one table (kind discriminates)
create table public.transfers (
  id               text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('SEND','WITHDRAW','INTERNAL')),
  amount_cents     bigint not null,
  fee_cents        bigint not null default 0,
  destination      text not null,
  note             text,
  status           text not null default 'CREATED'
    check (status in ('CREATED','PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','REVERSED')),
  fail_reason      text,
  provider_ref     text not null,
  idempotency_key  text,
  created_at_ms    bigint not null,
  events           jsonb not null default '[]'::jsonb
);
create index transfers_user_idx on public.transfers (user_id, created_at_ms desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id      text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ts_ms   bigint not null,
  title   text not null,
  body    text not null default '',
  kind    text not null check (kind in ('success','warning','info','error')),
  read    boolean not null default false
);
create index notifications_user_idx on public.notifications (user_id, ts_ms desc);

-- ---------------------------------------------------------------------------
-- backend-owned tables (Phase 2+ writes these with the service role;
-- owners can read their own rows now, nothing else)
-- ---------------------------------------------------------------------------
create table public.provider_events (
  id         bigserial primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  provider   text not null,
  event_type text not null,
  payload    jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create table public.webhook_events (
  id           bigserial primary key,
  source       text not null,
  signature_ok boolean not null default false,
  payload      jsonb not null default '{}'::jsonb,
  received_at  timestamptz not null default now()
);

create table public.audit_logs (
  id      bigserial primary key,
  user_id uuid references auth.users (id) on delete cascade,
  actor   text not null,
  action  text not null,
  meta    jsonb not null default '{}'::jsonb,
  at      timestamptz not null default now()
);

create table public.idempotency_keys (
  key        text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  response   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- auto-provision profile + wallet on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.kyc_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled on every table, owner-only access
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.wallets           enable row level security;
alter table public.ledger_entries    enable row level security;
alter table public.kyc_profiles      enable row level security;
alter table public.rail_accounts     enable row level security;
alter table public.beneficiaries     enable row level security;
alter table public.funding_intents   enable row level security;
alter table public.transfers         enable row level security;
alter table public.notifications     enable row level security;
alter table public.provider_events   enable row level security;
alter table public.webhook_events    enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.idempotency_keys  enable row level security;

create policy "profiles owner"        on public.profiles        for all using (id = auth.uid())      with check (id = auth.uid());
create policy "wallets owner"         on public.wallets         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ledger owner"          on public.ledger_entries  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kyc owner"             on public.kyc_profiles    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rail accounts owner"   on public.rail_accounts   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "beneficiaries owner"   on public.beneficiaries   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "funding owner"         on public.funding_intents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transfers owner"       on public.transfers       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications owner"   on public.notifications   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "idempotency owner"     on public.idempotency_keys for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- backend-fed tables: owners read their own rows; writes arrive via service role
create policy "provider events read" on public.provider_events for select using (user_id = auth.uid());
create policy "audit logs read"      on public.audit_logs      for select using (user_id = auth.uid());
