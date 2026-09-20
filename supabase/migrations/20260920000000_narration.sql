-- =====================================================================
-- Audiobook narration
--
-- Narration is billed per character, so the same page must never be paid
-- for twice: the audio is generated once, stored, and reused for every
-- reader. Access follows the same rule as the page itself.
-- =====================================================================

create table public.narrations (
  book_id     uuid not null references public.books on delete cascade,
  page        int  not null check (page >= 1),
  voice_id    text not null,
  model_id    text not null,
  audio_path  text not null,
  chars       int  not null default 0,
  duration_ms int,
  created_at  timestamptz not null default now(),
  primary key (book_id, page, voice_id, model_id)
);

comment on table public.narrations is
  'One generated audio file per (page, voice, model). Shared across all readers.';

create index narrations_book_idx on public.narrations (book_id, page);

-- per-user monthly spend, so one reader cannot narrate the whole catalogue
alter table public.ai_usage add column if not exists tts_chars bigint not null default 0;

alter table public.narrations enable row level security;

-- Readable by anyone allowed to read that page: preview pages are open,
-- the rest need a purchase or a live subscription.
create policy narrations_read on public.narrations
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.books b
      where b.id = narrations.book_id
        and b.status = 'published'
        and (narrations.page <= b.preview_pages or public.can_read_book(auth.uid(), b.id))
    )
  );

-- Only the narrate function (service role) writes rows; the client cannot
-- fabricate a narration row to point at someone else's audio.
create policy narrations_admin_write on public.narrations
  for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('narration', 'narration', false)
on conflict (id) do nothing;

create policy narration_storage_read on storage.objects
  for select using (
    bucket_id = 'narration'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.narrations n
        join public.books b on b.id = n.book_id
        where n.audio_path = storage.objects.name
          and b.status = 'published'
          and (n.page <= b.preview_pages or public.can_read_book(auth.uid(), b.id))
      )
    )
  );

create policy narration_storage_write on storage.objects
  for all using (bucket_id = 'narration' and public.is_admin())
  with check (bucket_id = 'narration' and public.is_admin());
