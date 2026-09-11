-- ===========================================================================
--  MaskOff AI — database schema
--
--  Two invariants drive the design:
--    1. One dilemma per group per day        -> unique (group_id, day)
--    2. Nobody sees an answer before reveal  -> RLS gates submissions on
--                                                rounds.reveal_at <= now()
-- ===========================================================================

create extension if not exists "pgcrypto";

-- Server clock, so clients can correct their own drift.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;

-- --------------------------------------------------------------------------
--  Groups & membership
-- --------------------------------------------------------------------------

create table if not exists public.groups (
  id                uuid primary key default gen_random_uuid(),
  name              text        not null,
  invite_code       text        not null unique,
  lang              text        not null default 'ar' check (lang in ('ar','en')),
  timezone          text        not null default 'Asia/Riyadh',
  drop_hour         smallint    not null default 20 check (drop_hour between 0 and 23),
  reveal_hour       smallint    not null default 21 check (reveal_hour between 0 and 23),
  streak            integer     not null default 0,
  last_perfect_day  date,
  created_at        timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  emoji      text not null default '🙂',
  accent     text not null default 'neon'
             check (accent in ('ice','coral','pistachio','butter','grape','neon')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members(user_id);

-- --------------------------------------------------------------------------
--  Rounds
-- --------------------------------------------------------------------------

create table if not exists public.rounds (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid        not null references public.groups(id) on delete cascade,
  day                date        not null,
  question           jsonb       not null,
  drop_at            timestamptz not null,
  reveal_at          timestamptz not null,
  roast              jsonb,
  roast_is_fallback  boolean     not null default false,
  created_at         timestamptz not null default now(),
  -- The idempotency guarantee: concurrent clients at 20:00 cannot create two
  -- different dilemmas for the same group and day.
  constraint rounds_group_day_key unique (group_id, day),
  constraint rounds_reveal_after_drop check (reveal_at > drop_at)
);

create index if not exists rounds_group_drop_idx on public.rounds(group_id, drop_at desc);

-- --------------------------------------------------------------------------
--  Submissions
-- --------------------------------------------------------------------------

create table if not exists public.submissions (
  round_id     uuid not null references public.rounds(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  choice       text not null check (choice in ('A','B')),
  -- { "<target user id>": "A" | "B" }
  stakes       jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- --------------------------------------------------------------------------
--  Row level security
-- --------------------------------------------------------------------------

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.rounds        enable row level security;
alter table public.submissions   enable row level security;

-- security definer avoids the recursive RLS lookup on group_members.
create or replace function public.is_member(target_group uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid()
  );
$$;

create policy "members read their groups"
  on public.groups for select
  using (public.is_member(id));

create policy "members read the roster"
  on public.group_members for select
  using (public.is_member(group_id));

create policy "members read rounds"
  on public.rounds for select
  using (public.is_member(group_id));

create policy "members create today's round"
  on public.rounds for insert
  with check (public.is_member(group_id));

-- The roast is written once, by whoever gets there first after the reveal.
create policy "members write the roast once"
  on public.rounds for update
  using (public.is_member(group_id) and roast is null and reveal_at <= now())
  with check (public.is_member(group_id));

-- The core secrecy rule: your own row any time, everyone else's only after
-- the reveal. This is enforced in the database, not in the client, so a
-- crafted request cannot read the group's answers early.
create policy "own submission always, others after reveal"
  on public.submissions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rounds r
      where r.id = submissions.round_id
        and r.reveal_at <= now()
        and public.is_member(r.group_id)
    )
  );

create policy "submit only for yourself, only before reveal"
  on public.submissions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.rounds r
      where r.id = round_id
        and now() between r.drop_at and r.reveal_at
        and public.is_member(r.group_id)
    )
  );

create policy "amend your own answer before reveal"
  on public.submissions for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.rounds r
      where r.id = round_id and now() < r.reveal_at
    )
  )
  with check (user_id = auth.uid());

-- --------------------------------------------------------------------------
--  Realtime
-- --------------------------------------------------------------------------

alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.group_members;

-- --------------------------------------------------------------------------
--  Squad streak — advance only when every member submitted before reveal.
-- --------------------------------------------------------------------------

create or replace function public.settle_streak(target_round uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.rounds%rowtype;
  member_n   integer;
  answered_n integer;
begin
  select * into r from public.rounds where id = target_round;
  if not found or r.reveal_at > now() then
    return;
  end if;

  select count(*) into member_n from public.group_members where group_id = r.group_id;
  select count(*) into answered_n
    from public.submissions s
    where s.round_id = r.id and s.submitted_at <= r.reveal_at;

  if answered_n >= member_n then
    update public.groups
       set streak = case when last_perfect_day = r.day - 1 then streak + 1 else 1 end,
           last_perfect_day = r.day
     where id = r.group_id and (last_perfect_day is null or last_perfect_day < r.day);
  else
    update public.groups set streak = 0 where id = r.group_id;
  end if;
end;
$$;
