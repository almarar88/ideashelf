-- ============================================================
-- مهامي — مخطط قاعدة بيانات المزامنة على Supabase
-- شغّل هذا الملف كاملاً في: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- جدول واحد يحمل كل السجلات (مهام ومشاريع) كحمولة JSON.
-- هذا يبقي المخطط ثابتاً حتى لو تغيّرت حقول المهمة في التطبيق.
create table if not exists public.records (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    sync_id     text not null,
    kind        text not null check (kind in ('task', 'project')),
    payload     jsonb not null default '{}'::jsonb,
    deleted     boolean not null default false,
    updated_at  timestamptz not null default now(),
    created_at  timestamptz not null default now(),

    -- المفتاح الذي يعتمد عليه upsert من التطبيق
    constraint records_user_sync_unique unique (user_id, sync_id)
);

create index if not exists records_user_updated_idx
    on public.records (user_id, updated_at desc);

create index if not exists records_user_kind_idx
    on public.records (user_id, kind);

-- ============================================================
-- أمان مستوى الصف: كل مستخدم يرى سجلاته فقط
-- ============================================================

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
create policy "records_select_own" on public.records
    for select using (auth.uid() = user_id);

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own" on public.records
    for insert with check (auth.uid() = user_id);

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own" on public.records
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "records_delete_own" on public.records;
create policy "records_delete_own" on public.records
    for delete using (auth.uid() = user_id);

-- ============================================================
-- تحديث updated_at تلقائياً عند كل تعديل
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists records_touch_updated_at on public.records;
create trigger records_touch_updated_at
    before update on public.records
    for each row execute function public.touch_updated_at();

-- ============================================================
-- حذف الحساب — متطلب إلزامي في سياسة Google Play
-- يستدعيه التطبيق عبر: POST /rest/v1/rpc/delete_account
-- SECURITY DEFINER لأن حذف المستخدم من auth.users يحتاج صلاحية أعلى،
-- لكن الدالة لا تحذف إلا صاحب الجلسة الحالية (auth.uid()).
-- ============================================================

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'not authenticated';
    end if;

    delete from public.records where user_id = uid;
    delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
