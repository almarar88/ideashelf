-- Majlis AI — Supabase schema. Run this in the SQL editor of your Supabase project.

-- Plans: what each subscription tier allows. Budgets protect your margin: a user can never
-- consume more AI than monthly_budget_usd in a calendar month.
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_usd numeric not null default 0,
  monthly_budget_usd numeric not null,       -- hard cap on AI cost per user per month
  daily_messages int not null,               -- hard cap on user messages per day (0 = unlimited)
  allowed_models text[] not null,            -- models this plan may use (others are downgraded)
  web_search boolean not null default false,
  council boolean not null default false,
  device_control boolean not null default false,
  max_tokens int not null default 8000
);

insert into public.plans (id, name, price_usd, monthly_budget_usd, daily_messages, allowed_models, web_search, council, device_control, max_tokens) values
  ('free',  'مجاني',  0,     0.60,  10, array['claude-haiku-4-5'],                                   false, false, false, 4000),
  ('pro',   'برو',    9.99,  4.00,  0,  array['claude-haiku-4-5','claude-sonnet-5'],                 true,  true,  true,  8000),
  ('ultra', 'ألترا',  29.99, 13.00, 0,  array['claude-haiku-4-5','claude-sonnet-5','claude-opus-5'], true,  true,  true,  16000)
on conflict (id) do update set
  name = excluded.name, price_usd = excluded.price_usd, monthly_budget_usd = excluded.monthly_budget_usd,
  daily_messages = excluded.daily_messages, allowed_models = excluded.allowed_models, web_search = excluded.web_search,
  council = excluded.council, device_control = excluded.device_control, max_tokens = excluded.max_tokens;

-- One row per user. plan is set by the RevenueCat webhook (or manually by you for gifts/tests).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' references public.plans(id),
  plan_source text default 'default',        -- 'revenuecat' | 'manual' | 'default'
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every metered API call.
create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read int not null default 0,
  cache_write int not null default 0,
  web_searches int not null default 0,
  cost_usd numeric not null default 0,
  is_user_message boolean not null default false
);
create index if not exists usage_events_user_ts on public.usage_events (user_id, ts desc);

-- Fast monthly totals (month = 'YYYY-MM').
create table if not exists public.usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  cost_usd numeric not null default 0,
  requests int not null default 0,
  messages int not null default 0,
  primary key (user_id, month)
);

-- Daily user-message counter for the free plan (day = 'YYYY-MM-DD').
create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  messages int not null default 0,
  primary key (user_id, day)
);

create or replace function public.increment_usage(p_user uuid, p_month text, p_day text, p_cost numeric, p_is_message boolean)
returns void language plpgsql security definer as $$
begin
  insert into public.usage_monthly (user_id, month, cost_usd, requests, messages)
  values (p_user, p_month, p_cost, 1, case when p_is_message then 1 else 0 end)
  on conflict (user_id, month) do update set
    cost_usd = public.usage_monthly.cost_usd + excluded.cost_usd,
    requests = public.usage_monthly.requests + 1,
    messages = public.usage_monthly.messages + excluded.messages;
  if p_is_message then
    insert into public.usage_daily (user_id, day, messages) values (p_user, p_day, 1)
    on conflict (user_id, day) do update set messages = public.usage_daily.messages + 1;
  end if;
end $$;

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Row level security: users can read their own profile and usage; only the server (service role) writes.
alter table public.profiles enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.usage_events enable row level security;
alter table public.usage_daily enable row level security;
alter table public.plans enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "own monthly" on public.usage_monthly;
create policy "own monthly" on public.usage_monthly for select using (auth.uid() = user_id);
drop policy if exists "own events" on public.usage_events;
create policy "own events" on public.usage_events for select using (auth.uid() = user_id);
drop policy if exists "own daily" on public.usage_daily;
create policy "own daily" on public.usage_daily for select using (auth.uid() = user_id);
drop policy if exists "plans public" on public.plans;
create policy "plans public" on public.plans for select using (true);
