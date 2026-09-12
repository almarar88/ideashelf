-- ════════════════════════════════════════════════════════════════════════════
--  Chrono AI — مخطط قاعدة البيانات وسياسات الوصول
--
--  يُنفَّذ مرة واحدة في: Supabase Dashboard → SQL Editor → New query → Run.
--  آمن لإعادة التنفيذ (idempotent): كل إنشاء مشروط، وكل سياسة تُحذف قبل إعادة
--  تعريفها.
--
--  المبدأ الحاكم: الخصوصية تُفرض هنا في القاعدة، لا في كود التطبيق. المفتاح
--  العام يُشحن داخل التطبيق ويستطيع أي أحد استخراجه، فالحماية الحقيقية هي
--  Row Level Security أدناه. لا تُعطّلها على أي جدول.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1) الحسابات ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  handle       text unique not null,
  name         text not null default '',
  bio          text not null default '',
  place        text not null default '',
  link         text not null default '',
  hue          int  not null default 44,
  avatar_url   text,
  cover        text[] not null default array['#2b3f8f','#6d5bd0','#f06ab0'],
  is_private   boolean not null default false,
  reply_policy text not null default 'everyone'
                 check (reply_policy in ('everyone','following','nobody')),
  signal_floor int not null default 40 check (signal_floor between 0 and 99),
  created_at   timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9_]{3,20}$')
);

-- ينشئ صفّ الملف الشخصي تلقائياً عند أول تسجيل، بمعرّف مبدئي فريد
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle, name)
  values (
    new.id,
    'u' || replace(substr(new.id::text, 1, 10), '-', ''),
    coalesce(split_part(new.email, '@', 1), 'مستخدم')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2) العلاقات ──────────────────────────────────────────────────────────────

create table if not exists public.follows (
  follower_id uuid not null references public.profiles on delete cascade,
  followee_id uuid not null references public.profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table if not exists public.mutes (
  muter_id uuid not null references public.profiles on delete cascade,
  muted_id uuid not null references public.profiles on delete cascade,
  primary key (muter_id, muted_id)
);

-- ── 3) دوال مساعدة (security definer لتجنّب ارتداد السياسات) ────────────────

create or replace function public.follows_me(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.follows
    where follower_id = auth.uid() and followee_id = target
  );
$$;

create or replace function public.blocked_between(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.profile_visible(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    -- لا قراءة بلا جلسة: المفتاح العام مشحون في التطبيق، فلو سمحنا بالقراءة
    -- المجهولة لاستطاع أي أحد سحب كل المحتوى العام بطلب واحد.
    when auth.uid() is null then false
    when auth.uid() = target then true
    when public.blocked_between(auth.uid(), target) then false
    when exists (select 1 from public.profiles p where p.id = target and not p.is_private) then true
    else public.follows_me(target)
  end;
$$;

-- ── 4) المنشورات ─────────────────────────────────────────────────────────────

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles on delete cascade,
  kind         text not null check (kind in ('film','essay','moment')),
  title        text not null,
  lede         text not null default '',
  body         text[] not null default '{}',
  place        text not null default '',
  media        text[] not null default array['#2b3f8f','#6d5bd0','#f06ab0'],
  photo_url    text,
  duration     text,
  audience     text not null default 'public'
                 check (audience in ('public','followers','private')),
  ai_share     int not null default 0 check (ai_share between 0 and 100),
  sources      jsonb not null default '[]',
  meta         jsonb not null default '{}',
  reactions    int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists posts_author_created on public.posts (author_id, created_at desc);
create index if not exists posts_created on public.posts (created_at desc);

create or replace function public.post_visible(post uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.posts p
    where p.id = post
      and (
        p.author_id = auth.uid()
        or (
          not public.blocked_between(auth.uid(), p.author_id)
          and public.profile_visible(p.author_id)
          and (
            p.audience = 'public'
            or (p.audience = 'followers' and public.follows_me(p.author_id))
          )
        )
      )
  );
$$;

-- ── 5) النقاش والتفاعل ───────────────────────────────────────────────────────

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  text       text not null check (char_length(text) between 1 and 2000),
  signal     int  not null default 0 check (signal between 0 and 99),
  kind       text not null default 'نقد',
  created_at timestamptz not null default now()
);

create index if not exists comments_post on public.comments (post_id, signal desc);

create table if not exists public.likes (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (post_id, user_id)
);

-- المحفوظات خاصة بصاحبها ولا يراها غيره
create table if not exists public.saves (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (post_id, user_id)
);

-- من يستطيع الرد: إعداد صاحب المنشور، يُفرض هنا لا في الواجهة
create or replace function public.may_reply(post uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = post
      and public.post_visible(post)
      and (
        p.author_id = auth.uid()
        or pr.reply_policy = 'everyone'
        or (pr.reply_policy = 'following' and exists (
              select 1 from public.follows f
              where f.follower_id = p.author_id and f.followee_id = auth.uid()
           ))
      )
  );
$$;

-- ── 6) الرسائل ───────────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  last_read_at    timestamptz not null default 'epoch',
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id       uuid not null references public.profiles on delete cascade,
  text            text not null check (char_length(text) between 1 and 4000),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation on public.messages (conversation_id, created_at);

create or replace function public.in_conversation(conv uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- ── 7) التنبيهات ─────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  actor_id   uuid references public.profiles on delete set null,
  kind       text not null check (kind in ('like','comment','follow','mention','system')),
  post_id    uuid references public.posts on delete cascade,
  text       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user on public.notifications (user_id, created_at desc);

-- ── 8) أطلس الحياة ───────────────────────────────────────────────────────────

create table if not exists public.atlas_moments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  title      text not null,
  place      text not null default '',
  date_label text not null default '',
  year       int  not null,
  season     text not null default 'شتاء',
  kind       text not null default 'محطة',
  x          numeric not null default 50,
  y          numeric not null default 50,
  depth      numeric not null default 0.5,
  note       text not null default '',
  tags       text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
--  السياسات — تُفعّل RLS على كل جدول بلا استثناء
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles             enable row level security;
alter table public.follows              enable row level security;
alter table public.blocks               enable row level security;
alter table public.mutes                enable row level security;
alter table public.posts                enable row level security;
alter table public.comments             enable row level security;
alter table public.likes                enable row level security;
alter table public.saves                enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.notifications        enable row level security;
alter table public.atlas_moments        enable row level security;

-- الملفات الشخصية
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (public.profile_visible(id));

drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- المتابعة
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select
  using (follower_id = auth.uid() or followee_id = auth.uid()
         or public.profile_visible(followee_id));

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert
  with check (follower_id = auth.uid()
              and not public.blocked_between(auth.uid(), followee_id));

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete
  using (follower_id = auth.uid());

-- الحظر والكتم: خاصان بصاحبهما تماماً
drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

drop policy if exists mutes_own on public.mutes;
create policy mutes_own on public.mutes for all
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());

-- المنشورات
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select
  using (public.post_visible(id));

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert
  with check (author_id = auth.uid());

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete
  using (author_id = auth.uid());

-- النقاش
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select
  using (public.post_visible(post_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (author_id = auth.uid() and public.may_reply(post_id));

-- يحذف الرد صاحبه، أو صاحب المنشور (إشراف على نقاشه)
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete
  using (author_id = auth.uid()
         or exists (select 1 from public.posts p
                    where p.id = post_id and p.author_id = auth.uid()));

-- الإعجاب
drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select
  using (public.post_visible(post_id));

drop policy if exists likes_write_own on public.likes;
create policy likes_write_own on public.likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- المحفوظات: لا يراها أحد غير صاحبها
drop policy if exists saves_own on public.saves;
create policy saves_own on public.saves for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- الرسائل
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations for select
  using (public.in_conversation(id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert
  with check (true);

drop policy if exists members_read on public.conversation_members;
create policy members_read on public.conversation_members for select
  using (public.in_conversation(conversation_id));

drop policy if exists members_insert on public.conversation_members;
create policy members_insert on public.conversation_members for insert
  with check (
    user_id = auth.uid()
    or (public.in_conversation(conversation_id)
        and not public.blocked_between(auth.uid(), user_id))
  );

drop policy if exists members_update_own on public.conversation_members;
create policy members_update_own on public.conversation_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select
  using (public.in_conversation(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.in_conversation(conversation_id));

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages for delete
  using (sender_id = auth.uid());

-- التنبيهات: يقرؤها المستلم وحده
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- يسمح بإنشاء تنبيه لشخص آخر فقط عن فعل قام به المُنشئ نفسه
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (
    (actor_id = auth.uid() and not public.blocked_between(auth.uid(), user_id))
    or (user_id = auth.uid() and kind = 'system')
  );

-- الأطلس: خاص بصاحبه
drop policy if exists atlas_own on public.atlas_moments;
create policy atlas_own on public.atlas_moments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
--  التخزين — صور الحسابات والمنشورات
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select
  using (bucket_id = 'media');

-- كل مستخدم يكتب داخل مجلد يحمل معرّفه فقط
drop policy if exists media_write_own on storage.objects;
create policy media_write_own on storage.objects for insert
  with check (
    bucket_id = 'media'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── تم ──────────────────────────────────────────────────────────────────────
