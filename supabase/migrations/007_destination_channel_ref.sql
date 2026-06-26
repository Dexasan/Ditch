-- ============================================================
-- DITCH — Destination channel reference (for chat ingestion)
-- Migration: 007_destination_channel_ref.sql
-- ============================================================
-- Pushing video only needs an RTMP URL + stream key. Reading a
-- platform's live chat additionally needs to know WHICH channel to
-- read from:
--   twitch  → channel login name (e.g. "shroud")
--   youtube → channel id (UC...) or @handle
-- channel_ref holds that identifier. Nullable: destinations without
-- it (or on platforms we don't ingest yet) simply contribute no chat.
-- ============================================================

alter table public.saved_destinations  add column channel_ref text;
alter table public.stream_destinations  add column channel_ref text;
