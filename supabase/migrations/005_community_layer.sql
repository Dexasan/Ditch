-- ============================================================
-- DITCH — Community Layer
-- Migration: 005_community_layer.sql
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type community_post_type as enum ('moment', 'discussion', 'suggestion');


-- ============================================================
-- TABLES
-- ============================================================

-- ------------------------------------------------------------
-- community_posts
-- Viewer-submitted posts attached to a channel.
-- Three types: moments (clips/timestamps), discussions (threads),
-- suggestions (voteable ideas for future streams).
-- ------------------------------------------------------------
create table public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.channels (id) on delete cascade,
  author_id   uuid not null references public.users (id) on delete cascade,
  type        community_post_type not null,
  title       text not null,
  body        text,
  media_url   text,
  session_id  uuid references public.live_sessions (id) on delete set null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- community_votes
-- One vote per user per post. Composite PK enforces uniqueness.
-- ------------------------------------------------------------
create table public.community_votes (
  post_id     uuid not null references public.community_posts (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);


-- ============================================================
-- INDEXES
-- ============================================================

create index idx_community_posts_channel_id   on public.community_posts (channel_id, created_at desc);
create index idx_community_posts_channel_type  on public.community_posts (channel_id, type);
create index idx_community_votes_post_id       on public.community_votes (post_id);
create index idx_community_votes_user_id       on public.community_votes (user_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.community_posts enable row level security;
alter table public.community_votes enable row level security;

-- Posts: anyone can read
create policy "community_posts: public read"
  on public.community_posts for select
  using (true);

-- Posts: authenticated users can create their own
create policy "community_posts: authenticated insert"
  on public.community_posts for insert
  with check (auth.uid() is not null and auth.uid() = author_id);

-- Posts: channel owner can update (pin/unpin)
create policy "community_posts: owner update"
  on public.community_posts for update
  using (auth.uid() = (select owner_id from public.channels where id = channel_id));

-- Posts: author or channel owner can delete
create policy "community_posts: author or owner delete"
  on public.community_posts for delete
  using (
    auth.uid() = author_id
    or auth.uid() = (select owner_id from public.channels where id = channel_id)
  );

-- Votes: anyone can read
create policy "community_votes: public read"
  on public.community_votes for select
  using (true);

-- Votes: authenticated users can cast their own vote
create policy "community_votes: authenticated insert"
  on public.community_votes for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- Votes: users can remove their own vote
create policy "community_votes: self delete"
  on public.community_votes for delete
  using (auth.uid() = user_id);
