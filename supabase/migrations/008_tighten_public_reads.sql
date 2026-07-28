-- ============================================================
-- DITCH: Tighten over-permissive public reads
-- Migration: 008_tighten_public_reads.sql
-- ============================================================
-- NEXT_PUBLIC_SUPABASE_ANON_KEY is inlined into the browser bundle, so anyone
-- can lift it and query PostgREST directly, bypassing the API server and every
-- ownership check it performs. RLS is the only boundary that still applies on
-- that path, so any `using (true)` policy is effectively an anonymous public
-- endpoint.
--
-- Two tables were readable that way but hold data the API deliberately never
-- returns in raw form:
--
--   participants:      `using (true)` exposed the full roster including
--                      `waiting` and `removed` rows, letting anyone enumerate
--                      who asked to join a stream and who got kicked off it,
--                      keyed by `user_id`. Only people actually on screen are
--                      public information.
--
--   community_votes:   `using (true)` exposed every individual (post_id,
--                      user_id) pair, i.e. a per-user voting record. The API
--                      only ever emits an aggregate `vote_count` plus the
--                      caller's own `has_voted`; this policy leaked the raw
--                      ballots the aggregation was hiding.
--
-- No application code reads either table with the browser client. The API and
-- realtime servers both use the service-role client, which bypasses RLS, so
-- narrowing these is invisible to the running product.
-- ============================================================


-- ------------------------------------------------------------
-- participants
-- Public sees only who is on screen. The channel owner sees the
-- whole queue (waiting / approved / removed), and a viewer can
-- always see their own row so the "you're in the queue" state
-- keeps working.
-- ------------------------------------------------------------

drop policy if exists "participants: public read" on public.participants;

create policy "participants: public read live only"
  on public.participants for select
  using (
    status = 'live'
    or user_id = auth.uid()
    or auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.live_sessions ls on ls.channel_id = c.id
      where ls.id = participants.session_id
    )
  );


-- ------------------------------------------------------------
-- community_votes
-- A voter can see their own ballot; the channel owner can see the
-- ballots on their own channel's posts. Aggregate counts continue
-- to be served by the API, which reads with the service role.
-- ------------------------------------------------------------

drop policy if exists "community_votes: public read" on public.community_votes;

create policy "community_votes: self or channel owner read"
  on public.community_votes for select
  using (
    user_id = auth.uid()
    or auth.uid() = (
      select c.owner_id
      from public.channels c
      join public.community_posts p on p.channel_id = c.id
      where p.id = community_votes.post_id
    )
  );
