-- ============================================================
-- DITCH — One channel per user
-- Migration: 002_one_channel_per_user.sql
-- ============================================================
-- Enforces that each user can own at most one channel,
-- matching the Twitch-style single-channel-per-creator model.
-- ============================================================

alter table public.channels
  add constraint channels_owner_id_unique unique (owner_id);
