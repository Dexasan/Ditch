-- ============================================================
-- DITCH — Saved (persistent) stream destinations
-- Migration: 005_saved_destinations.sql
-- ============================================================
-- stream_destinations is per-session, so creators had to re-enter
-- their RTMP URL + stream key on every broadcast. saved_destinations
-- lives at the channel level and persists across sessions. When a
-- creator goes live, the selected saved destinations are copied into
-- stream_destinations for that session (the relay reads from there).
-- ============================================================

create table public.saved_destinations (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references public.channels (id) on delete cascade,
  platform      stream_platform not null,
  label         text,
  rtmp_url      text not null,
  stream_key    text not null,
  created_at    timestamptz not null default now()
);

create index idx_saved_destinations_channel_id on public.saved_destinations (channel_id);

-- ------------------------------------------------------------
-- RLS — credentials are private, channel owner only.
-- ------------------------------------------------------------
alter table public.saved_destinations enable row level security;

create policy "saved_destinations: owner read"
  on public.saved_destinations for select
  using (
    auth.uid() = (select owner_id from public.channels where id = channel_id)
  );

create policy "saved_destinations: owner insert"
  on public.saved_destinations for insert
  with check (
    auth.uid() = (select owner_id from public.channels where id = channel_id)
  );

create policy "saved_destinations: owner update"
  on public.saved_destinations for update
  using (
    auth.uid() = (select owner_id from public.channels where id = channel_id)
  );

create policy "saved_destinations: owner delete"
  on public.saved_destinations for delete
  using (
    auth.uid() = (select owner_id from public.channels where id = channel_id)
  );
