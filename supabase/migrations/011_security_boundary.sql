-- Direct database access is read-only and owner/subject scoped. All product writes
-- and intentional public projections go through the API (service_role + guards).
-- In particular, credentials and participant transitions must never bypass the API.
-- Transactional: apply with the usual migration runner.

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
drop policy if exists "users: read own" on public.users;
drop policy if exists "users: update own" on public.users;
create policy "users: scoped read" on public.users
  for select to authenticated using (id = (select auth.uid()));
grant select on public.users to authenticated;

alter table public.channels enable row level security;
revoke all on public.channels from anon, authenticated;
drop policy if exists "channels: owner delete" on public.channels;
drop policy if exists "channels: owner insert" on public.channels;
drop policy if exists "channels: owner update" on public.channels;
drop policy if exists "channels: public read" on public.channels;
create policy "channels: scoped read" on public.channels
  for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.channels to authenticated;

alter table public.live_sessions enable row level security;
revoke all on public.live_sessions from anon, authenticated;
drop policy if exists "live_sessions: owner delete" on public.live_sessions;
drop policy if exists "live_sessions: owner insert" on public.live_sessions;
drop policy if exists "live_sessions: owner update" on public.live_sessions;
drop policy if exists "live_sessions: public read" on public.live_sessions;
create policy "live_sessions: scoped read" on public.live_sessions
  for select to authenticated using (exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = (select auth.uid())));
grant select on public.live_sessions to authenticated;

alter table public.stream_destinations enable row level security;
revoke all on public.stream_destinations from anon, authenticated;
drop policy if exists "stream_destinations: owner delete" on public.stream_destinations;
drop policy if exists "stream_destinations: owner insert" on public.stream_destinations;
drop policy if exists "stream_destinations: owner read" on public.stream_destinations;
drop policy if exists "stream_destinations: owner update" on public.stream_destinations;
create policy "stream_destinations: scoped read" on public.stream_destinations
  for select to authenticated using (exists (select 1 from public.live_sessions s join public.channels c on c.id = s.channel_id where s.id = session_id and c.owner_id = (select auth.uid())));

alter table public.saved_destinations enable row level security;
revoke all on public.saved_destinations from anon, authenticated;
drop policy if exists "saved_destinations: owner delete" on public.saved_destinations;
drop policy if exists "saved_destinations: owner insert" on public.saved_destinations;
drop policy if exists "saved_destinations: owner read" on public.saved_destinations;
drop policy if exists "saved_destinations: owner update" on public.saved_destinations;
create policy "saved_destinations: scoped read" on public.saved_destinations
  for select to authenticated using (exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = (select auth.uid())));

alter table public.participants enable row level security;
revoke all on public.participants from anon, authenticated;
drop policy if exists "participants: owner delete" on public.participants;
drop policy if exists "participants: owner update" on public.participants;
drop policy if exists "participants: public read live only" on public.participants;
drop policy if exists "participants: self insert" on public.participants;
create policy "participants: scoped read" on public.participants
  for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.live_sessions s join public.channels c on c.id = s.channel_id where s.id = session_id and c.owner_id = (select auth.uid())));
grant select on public.participants to authenticated;

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
drop policy if exists "chat_messages: authenticated insert" on public.chat_messages;
drop policy if exists "chat_messages: public read" on public.chat_messages;
create policy "chat_messages: scoped read" on public.chat_messages
  for select to authenticated using (exists (select 1 from public.live_sessions s join public.channels c on c.id = s.channel_id where s.id = session_id and c.owner_id = (select auth.uid())));
grant select on public.chat_messages to authenticated;

alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon, authenticated;
drop policy if exists "community_posts: authenticated insert" on public.community_posts;
drop policy if exists "community_posts: author or owner delete" on public.community_posts;
drop policy if exists "community_posts: owner update" on public.community_posts;
drop policy if exists "community_posts: public read" on public.community_posts;
create policy "community_posts: scoped read" on public.community_posts
  for select to authenticated using (author_id = (select auth.uid()) or exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = (select auth.uid())));
grant select on public.community_posts to authenticated;

alter table public.community_votes enable row level security;
revoke all on public.community_votes from anon, authenticated;
drop policy if exists "community_votes: authenticated insert" on public.community_votes;
drop policy if exists "community_votes: self delete" on public.community_votes;
drop policy if exists "community_votes: self or channel owner read" on public.community_votes;
create policy "community_votes: scoped read" on public.community_votes
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.community_votes to authenticated;

alter table public.channel_memberships enable row level security;
revoke all on public.channel_memberships from anon, authenticated;
drop policy if exists "channel_memberships: self delete" on public.channel_memberships;
drop policy if exists "channel_memberships: self insert" on public.channel_memberships;
drop policy if exists "channel_memberships: self or channel owner read" on public.channel_memberships;
drop policy if exists "channel_memberships: self update" on public.channel_memberships;
create policy "channel_memberships: scoped read" on public.channel_memberships
  for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = (select auth.uid())));
grant select on public.channel_memberships to authenticated;

alter table public.community_comments enable row level security;
revoke all on public.community_comments from anon, authenticated;
drop policy if exists "community_comments: author or owner delete" on public.community_comments;
drop policy if exists "community_comments: author or owner update" on public.community_comments;
drop policy if exists "community_comments: public read" on public.community_comments;
drop policy if exists "community_comments: self insert" on public.community_comments;
create policy "community_comments: scoped read" on public.community_comments
  for select to authenticated using (author_id = (select auth.uid()) or exists (select 1 from public.community_posts p join public.channels c on c.id = p.channel_id where p.id = post_id and c.owner_id = (select auth.uid())));
grant select on public.community_comments to authenticated;

alter table public.community_post_events enable row level security;
revoke all on public.community_post_events from anon, authenticated;
drop policy if exists "community_post_events: channel owner insert" on public.community_post_events;
drop policy if exists "community_post_events: public read" on public.community_post_events;
create policy "community_post_events: scoped read" on public.community_post_events
  for select to authenticated using (actor_id = (select auth.uid()) or exists (select 1 from public.community_posts p join public.channels c on c.id = p.channel_id where p.id = post_id and c.owner_id = (select auth.uid())));
grant select on public.community_post_events to authenticated;

alter table public.community_notifications enable row level security;
revoke all on public.community_notifications from anon, authenticated;
drop policy if exists "community_notifications: recipient read" on public.community_notifications;
drop policy if exists "community_notifications: recipient update" on public.community_notifications;
create policy "community_notifications: scoped read" on public.community_notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
grant select on public.community_notifications to authenticated;

alter table public.show_rundown_items enable row level security;
revoke all on public.show_rundown_items from anon, authenticated;
drop policy if exists "show_rundown_items: channel owner all" on public.show_rundown_items;
create policy "show_rundown_items: scoped read" on public.show_rundown_items
  for select to authenticated using (exists (select 1 from public.live_sessions s join public.channels c on c.id = s.channel_id where s.id = session_id and c.owner_id = (select auth.uid())));
grant select on public.show_rundown_items to authenticated;

-- Trigger functions intentionally bypass RLS only for internal bootstrap/DDL.
alter function public.handle_new_user() set search_path = '';
revoke execute on all functions in schema public from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
-- Supabase's application migrations run as postgres. New objects fail closed.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
