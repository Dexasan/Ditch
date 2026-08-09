-- Turn community posts into a durable creator/viewer workflow.

create type community_post_status as enum (
  'open', 'shortlisted', 'planned', 'used', 'completed', 'declined'
);

create type community_notification_type as enum (
  'comment', 'creator_response', 'status_change', 'used_on_stream'
);

create type rundown_item_state as enum ('planned', 'used', 'skipped');

alter table public.community_posts
  add column status community_post_status not null default 'open',
  add column creator_response text,
  add column updated_at timestamptz not null default now();

create table public.channel_memberships (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  notification_level text not null default 'important'
    check (notification_level in ('none', 'important', 'all')),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_post_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  actor_id uuid not null references public.users (id) on delete cascade,
  event_type text not null check (event_type in ('creator_response', 'status_change', 'added_to_rundown', 'used_on_stream')),
  from_status community_post_status,
  to_status community_post_status,
  session_id uuid references public.live_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  channel_id uuid not null references public.channels (id) on delete cascade,
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  type community_notification_type not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.show_rundown_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  post_id uuid not null references public.community_posts (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  state rundown_item_state not null default 'planned',
  added_at timestamptz not null default now(),
  used_at timestamptz,
  unique (session_id, post_id)
);

create index idx_channel_memberships_user on public.channel_memberships (user_id, joined_at desc);
create index idx_community_comments_post on public.community_comments (post_id, created_at asc);
create index idx_community_post_events_post on public.community_post_events (post_id, created_at asc);
create index idx_community_notifications_recipient on public.community_notifications (recipient_id, read_at, created_at desc);
create index idx_show_rundown_session on public.show_rundown_items (session_id, position, added_at);
create index idx_community_posts_status on public.community_posts (channel_id, status, created_at desc);

alter table public.channel_memberships enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_post_events enable row level security;
alter table public.community_notifications enable row level security;
alter table public.show_rundown_items enable row level security;

create policy "channel_memberships: self or channel owner read" on public.channel_memberships for select
  using (user_id = auth.uid() or auth.uid() = (select owner_id from public.channels where id = channel_id));
create policy "channel_memberships: self insert" on public.channel_memberships for insert
  with check (user_id = auth.uid());
create policy "channel_memberships: self update" on public.channel_memberships for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "channel_memberships: self delete" on public.channel_memberships for delete
  using (user_id = auth.uid());

create policy "community_comments: public read" on public.community_comments for select using (true);
create policy "community_comments: self insert" on public.community_comments for insert
  with check (author_id = auth.uid());
create policy "community_comments: author or owner update" on public.community_comments for update
  using (author_id = auth.uid() or auth.uid() = (
    select c.owner_id from public.channels c join public.community_posts p on p.channel_id = c.id where p.id = post_id
  ));
create policy "community_comments: author or owner delete" on public.community_comments for delete
  using (author_id = auth.uid() or auth.uid() = (
    select c.owner_id from public.channels c join public.community_posts p on p.channel_id = c.id where p.id = post_id
  ));

create policy "community_post_events: public read" on public.community_post_events for select using (true);
create policy "community_post_events: channel owner insert" on public.community_post_events for insert
  with check (actor_id = auth.uid() and auth.uid() = (
    select c.owner_id from public.channels c join public.community_posts p on p.channel_id = c.id where p.id = post_id
  ));

create policy "community_notifications: recipient read" on public.community_notifications for select
  using (recipient_id = auth.uid());
create policy "community_notifications: recipient update" on public.community_notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "show_rundown_items: channel owner all" on public.show_rundown_items for all
  using (auth.uid() = (
    select c.owner_id from public.channels c join public.live_sessions s on s.channel_id = c.id where s.id = session_id
  ))
  with check (auth.uid() = (
    select c.owner_id from public.channels c join public.live_sessions s on s.channel_id = c.id where s.id = session_id
  ));
