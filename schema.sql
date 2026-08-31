-- DailyBudget — schéma Supabase
-- À exécuter dans Supabase → SQL Editor

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  category text not null,
  amount numeric not null check (amount > 0),
  note text default '',
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

-- Budget mensuel personnalisable par utilisateur
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget numeric not null default 300000,
  updated_at timestamptz not null default now()
);

-- Row Level Security : chacun ne voit / modifie que ses propres données
alter table public.transactions enable row level security;
alter table public.settings enable row level security;

create policy "select own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

create policy "select own settings"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "upsert own settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "update own settings"
  on public.settings for update
  using (auth.uid() = user_id);

-- Active le realtime pour la synchronisation multi-appareils
alter publication supabase_realtime add table public.transactions;
