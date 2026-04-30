-- ============================================================
-- DITCH — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================
-- Run this in the Supabase dashboard SQL editor, or via:
--   supabase db push  (if using the Supabase CLI)
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

-- gen_random_uuid() for primary keys (built-in since PG 13)


-- ============================================================
-- ENUMS
-- ============================================================

create type stream_platform as enum (
  'twitch',
  'youtube',
  'tiktok',
  'kick',
  'ditch'
);

create type session_status as enum (
  'idle',
  'live',
  'ending',
  'ended'
);

create type participant_status as enum (
  'waiting',
  'approved',
  'live',
  'removed'
);

create type destination_status as enum (
  'connecting',
  'live',
  'error',
  'stopped'
);


-- ============================================================
-- TABLES
-- ============================================================

-- ------------------------------------------------------------
-- users
-- Extends Supabase auth.users with profile data.
-- Populated automatically via trigger on auth.users insert.
-- ------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- channels
-- One channel per creator. slug is the public URL identifier.
-- ------------------------------------------------------------
create table public.channels (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.users (id) on delete cascade,
  slug          text not null unique,
  display_name  text not null,
  description   text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- live_sessions
-- Each broadcast event on a channel.
-- ------------------------------------------------------------
create table public.live_sessions (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references public.channels (id) on delete cascade,
  status        session_status not null default 'idle',
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- stream_destinations
-- RTMP targets for a session. Credentials are server-side only
-- and must never be returned to the browser.
-- ------------------------------------------------------------
create table public.stream_destinations (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.live_sessions (id) on delete cascade,
  platform      stream_platform not null,
  rtmp_url      text not null,
  stream_key    text not null,
  status        destination_status not null default 'stopped',
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- participants
-- Viewers who have moved from watching to appearing on stream.
-- user_id is nullable — anonymous/external viewers are allowed.
-- slot_index is the on-screen position (0-based), assigned when
-- status moves to 'live'.
-- ------------------------------------------------------------
create table public.participants (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.live_sessions (id) on delete cascade,
  user_id          uuid references public.users (id) on delete set null,
  display_name     text not null,
  platform_origin  stream_platform not null,
  status           participant_status not null default 'waiting',
  slot_index       integer,
  joined_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- chat_messages
-- Normalized messages from all connected platforms.
-- Append-only — no updates or deletes.
-- ------------------------------------------------------------
create table public.chat_messages (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.live_sessions (id) on delete cascade,
  platform             stream_platform not null,
  author_display_name  text not null,
  author_avatar_url    text,
  body                 text not null,
  timestamp            timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- Channel lookup by slug (used on every channel page load)
create index idx_channels_slug on public.channels (slug);

-- Session queries by channel
create index idx_live_sessions_channel_id on public.live_sessions (channel_id);

-- Destination queries by session
create index idx_stream_destinations_session_id on public.stream_destinations (session_id);

-- Participant queries by session + status (creator queue view)
create index idx_participants_session_id on public.participants (session_id);
create index idx_participants_session_status on public.participants (session_id, status);

-- Chat queries by session, ordered by time
create index idx_chat_messages_session_id_timestamp on public.chat_messages (session_id, timestamp);


-- ============================================================
-- TRIGGER: auto-create user profile on signup
-- When a new row is inserted into auth.users (Supabase handles
-- this on signup), mirror it into public.users automatically.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all public tables
alter table public.users               enable row level security;
alter table public.channels            enable row level security;
alter table public.live_sessions       enable row level security;
alter table public.stream_destinations enable row level security;
alter table public.participants        enable row level security;
alter table public.chat_messages       enable row level security;


-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------

-- Users can read and update only their own profile
create policy "users: read own"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own"
  on public.users for update
  using (auth.uid() = id);


-- ------------------------------------------------------------
-- channels
-- ------------------------------------------------------------

-- Anyone (including unauthenticated) can read channels — needed for public channel pages
create policy "channels: public read"
  on public.channels for select
  using (true);

-- Only the owner can insert, update, or delete their channel
create policy "channels: owner insert"
  on public.channels for insert
  with check (auth.uid() = owner_id);

create policy "channels: owner update"
  on public.channels for update
  using (auth.uid() = owner_id);

create policy "channels: owner delete"
  on public.channels for delete
  using (auth.uid() = owner_id);


-- ------------------------------------------------------------
-- live_sessions
-- ------------------------------------------------------------

-- Anyone can read sessions (needed to display live status on channel page)
create policy "live_sessions: public read"
  on public.live_sessions for select
  using (true);

-- Only the channel owner can create or modify sessions
create policy "live_sessions: owner insert"
  on public.live_sessions for insert
  with check (
    auth.uid() = (
      select owner_id from public.channels where id = channel_id
    )
  );

create policy "live_sessions: owner update"
  on public.live_sessions for update
  using (
    auth.uid() = (
      select owner_id from public.channels
      join public.live_sessions ls on ls.channel_id = channels.id
      where ls.id = live_sessions.id
    )
  );

create policy "live_sessions: owner delete"
  on public.live_sessions for delete
  using (
    auth.uid() = (
      select owner_id from public.channels
      join public.live_sessions ls on ls.channel_id = channels.id
      where ls.id = live_sessions.id
    )
  );


-- ------------------------------------------------------------
-- stream_destinations
-- RTMP credentials are private — channel owner only.
-- ------------------------------------------------------------

create policy "stream_destinations: owner read"
  on public.stream_destinations for select
  using (
    auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = session_id
    )
  );

create policy "stream_destinations: owner insert"
  on public.stream_destinations for insert
  with check (
    auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = session_id
    )
  );

create policy "stream_destinations: owner update"
  on public.stream_destinations for update
  using (
    auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = session_id
    )
  );

create policy "stream_destinations: owner delete"
  on public.stream_destinations for delete
  using (
    auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = session_id
    )
  );


-- ------------------------------------------------------------
-- participants
-- ------------------------------------------------------------

-- Anyone can read participants for a session (visible on channel page)
create policy "participants: public read"
  on public.participants for select
  using (true);

-- Authenticated users can request to join (insert their own participant row)
create policy "participants: self insert"
  on public.participants for insert
  with check (
    auth.uid() is not null
    and (user_id = auth.uid() or user_id is null)
  );

-- Channel owner can update participant status (approve / set slot / remove)
create policy "participants: owner update"
  on public.participants for update
  using (
    auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = session_id
    )
  );

-- Channel owner can delete participants
create policy "participants: owner delete"
  on public.participants for delete
  using (
    auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = session_id
    )
  );


-- ------------------------------------------------------------
-- chat_messages
-- Append-only. No updates or deletes for anyone.
-- ------------------------------------------------------------

-- Anyone can read chat (live feed on channel page)
create policy "chat_messages: public read"
  on public.chat_messages for select
  using (true);

-- Authenticated users can insert messages
create policy "chat_messages: authenticated insert"
  on public.chat_messages for insert
  with check (auth.uid() is not null);
