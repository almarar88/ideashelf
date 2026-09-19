-- =====================================================================
-- مكتبة الكود الرقمية — schema for accounts, store, entitlements
--
-- Security model: the device is never trusted. Every "may this user read
-- this page?" decision is enforced here by row level security, so a
-- patched client cannot read a book it has not paid for.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create type public.user_role as enum ('reader', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text        not null,
  display_name text,
  role        public.user_role not null default 'reader',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per account. role=admin may publish books.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- books
-- ---------------------------------------------------------------------
create type public.book_status as enum ('draft', 'published', 'hidden');

create table public.books (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  author        text,
  description   text,
  language      text not null default 'ar',
  cover_url     text,
  page_count    int  not null default 0,
  -- price in the smallest currency unit (fils). 0 = free.
  price_minor   int  not null default 0,
  currency      text not null default 'AED',
  -- how many pages anyone may read before paying
  preview_pages int  not null default 5,
  -- true = readable by any active subscriber
  in_subscription boolean not null default true,
  status        public.book_status not null default 'draft',
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index books_status_idx on public.books (status);

-- ---------------------------------------------------------------------
-- book pages: one row per page. image_path points into a PRIVATE bucket,
-- so the bytes are only reachable through a short-lived signed URL.
-- ---------------------------------------------------------------------
create table public.book_pages (
  book_id    uuid not null references public.books on delete cascade,
  page       int  not null check (page >= 1),
  image_path text not null,
  width      int,
  height     int,
  text       text not null default '',
  primary key (book_id, page)
);

-- ---------------------------------------------------------------------
-- purchases and subscriptions
-- ---------------------------------------------------------------------
create type public.pay_provider as enum ('google_play', 'stripe', 'manual');

create table public.purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  book_id       uuid not null references public.books on delete cascade,
  provider      public.pay_provider not null,
  -- the provider's own id; unique so a receipt cannot be redeemed twice
  provider_txn  text not null,
  amount_minor  int  not null,
  currency      text not null default 'AED',
  created_at    timestamptz not null default now(),
  unique (provider, provider_txn),
  unique (user_id, book_id)
);

create type public.sub_status as enum ('active', 'canceled', 'expired', 'grace');

create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  plan          text not null,
  provider      public.pay_provider not null,
  provider_txn  text not null,
  status        public.sub_status not null default 'active',
  current_period_end timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, provider_txn)
);

create index subscriptions_user_idx on public.subscriptions (user_id, status);

create or replace function public.has_active_subscription(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active', 'grace')
      and s.current_period_end > now()
  );
$$;

create or replace function public.can_read_book(uid uuid, bid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.purchases p where p.user_id = uid and p.book_id = bid)
      or exists (
           select 1 from public.books b
           where b.id = bid
             and (b.price_minor = 0
                  or (b.in_subscription and public.has_active_subscription(uid)))
         );
$$;

comment on function public.can_read_book is
  'Single source of truth for access: owned outright, free, or covered by an active subscription.';

-- ---------------------------------------------------------------------
-- reading progress (synced across devices)
-- ---------------------------------------------------------------------
create table public.reading_progress (
  user_id         uuid not null references auth.users on delete cascade,
  book_id         uuid not null references public.books on delete cascade,
  last_page       int  not null default 1,
  reading_seconds int  not null default 0,
  favorite        boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- ---------------------------------------------------------------------
-- AI results. Shared per (book, scope, kind) so the same analysis is
-- paid for once, not once per reader.
-- ---------------------------------------------------------------------
create table public.ai_results (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books on delete cascade,
  kind       text not null,
  scope_key  text not null,
  scope_label text not null,
  content    text not null,
  model      text not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (book_id, kind, scope_key)
);

create table public.ai_usage (
  user_id     uuid not null references auth.users on delete cascade,
  month       date not null,
  input_tokens  bigint not null default 0,
  output_tokens bigint not null default 0,
  requests    int not null default 0,
  primary key (user_id, month)
);

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.books            enable row level security;
alter table public.book_pages       enable row level security;
alter table public.purchases        enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.reading_progress enable row level security;
alter table public.ai_results       enable row level security;
alter table public.ai_usage         enable row level security;

-- profiles: you see and edit only yourself; admins see everyone
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- books: published books are public; admins manage everything
create policy books_public_read on public.books
  for select using (status = 'published' or public.is_admin());
create policy books_admin_write on public.books
  for all using (public.is_admin()) with check (public.is_admin());

-- pages: the core rule. Preview pages are open; the rest need entitlement.
create policy book_pages_read on public.book_pages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.books b
      where b.id = book_pages.book_id
        and b.status = 'published'
        and (book_pages.page <= b.preview_pages or public.can_read_book(auth.uid(), b.id))
    )
  );
create policy book_pages_admin_write on public.book_pages
  for all using (public.is_admin()) with check (public.is_admin());

-- purchases and subscriptions: readable by their owner, never writable by
-- the client. Only a verified server function (service role) inserts them.
create policy purchases_own_read on public.purchases
  for select using (user_id = auth.uid() or public.is_admin());
create policy subscriptions_own_read on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- progress: fully owned by the user
create policy progress_own_all on public.reading_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai results: visible to anyone who may read the book
create policy ai_results_read on public.ai_results
  for select using (
    public.is_admin()
    or exists (select 1 from public.books b where b.id = ai_results.book_id
               and b.status = 'published' and public.can_read_book(auth.uid(), b.id))
  );

create policy ai_usage_own_read on public.ai_usage
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Storage: one private bucket. No public read at all; the client only
-- ever receives short-lived signed URLs minted after an access check.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('book-pages', 'book-pages', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy book_pages_storage_read on storage.objects
  for select using (
    bucket_id = 'book-pages'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.book_pages bp
        join public.books b on b.id = bp.book_id
        where bp.image_path = storage.objects.name
          and b.status = 'published'
          and (bp.page <= b.preview_pages or public.can_read_book(auth.uid(), b.id))
      )
    )
  );

create policy book_pages_storage_write on storage.objects
  for all using (bucket_id = 'book-pages' and public.is_admin())
  with check (bucket_id = 'book-pages' and public.is_admin());

create policy covers_read on storage.objects
  for select using (bucket_id = 'covers');
create policy covers_write on storage.objects
  for all using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());
