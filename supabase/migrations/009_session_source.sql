-- Distinguish the browser compositor from an external RTMP encoder. The relay
-- uses this to prevent two producers from publishing the same session.

create type session_source as enum ('browser', 'rtmp');

alter table public.live_sessions
  add column source_type session_source not null default 'browser';