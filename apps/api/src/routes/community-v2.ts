import type { FastifyInstance } from "fastify";
import { supabaseAdmin, verifyAccessToken } from "@ditch/db";
import type {
  CommunityPostStatus,
  CommunityPostV2,
  CommunityRundownItem,
} from "@ditch/types/src/community";
import { authenticate } from "../lib/authenticate";

const db = supabaseAdmin as any;
const POST_TYPES = new Set(["moment", "discussion", "suggestion"]);
const POST_STATUSES = new Set<CommunityPostStatus>([
  "open", "shortlisted", "planned", "used", "completed", "declined",
]);

const ALLOWED_TRANSITIONS: Record<CommunityPostStatus, CommunityPostStatus[]> = {
  open: ["shortlisted", "planned", "declined"],
  shortlisted: ["open", "planned", "declined"],
  planned: ["shortlisted", "used", "completed"],
  used: ["completed"],
  completed: ["open"],
  declined: ["open"],
};

async function optionalUserId(authorization?: string): Promise<string | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const user = await verifyAccessToken(authorization.slice(7));
  return user?.id ?? null;
}

function shapePost(row: any, userId: string | null): CommunityPostV2 {
  return {
    id: row.id,
    channel_id: row.channel_id,
    channel_slug: row.channels?.slug ?? "",
    author_id: row.author_id,
    author_display_name: row.users?.display_name ?? "Unknown",
    author_avatar_url: row.users?.avatar_url ?? null,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    media_url: row.media_url ?? null,
    session_id: row.session_id ?? null,
    is_pinned: row.is_pinned,
    status: row.status ?? "open",
    creator_response: row.creator_response ?? null,
    vote_count: (row.community_votes ?? []).length,
    comment_count: (row.community_comments ?? []).length,
    user_voted: Boolean(userId && (row.community_votes ?? []).some((vote: any) => vote.user_id === userId)),
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

function rankPosts(posts: CommunityPostV2[]): CommunityPostV2[] {
  const statusWeight: Record<CommunityPostStatus, number> = {
    planned: 5,
    shortlisted: 4,
    open: 3,
    used: 2,
    completed: 1,
    declined: 0,
  };
  return posts.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const statusDiff = statusWeight[b.status] - statusWeight[a.status];
    if (statusDiff) return statusDiff;
    const engagementDiff = (b.vote_count + b.comment_count * 2) - (a.vote_count + a.comment_count * 2);
    return engagementDiff || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

async function getChannelBySlug(slug: string) {
  const { data } = await db.from("channels").select("id, slug, display_name, owner_id").eq("slug", slug).maybeSingle();
  return data as { id: string; slug: string; display_name: string; owner_id: string } | null;
}

async function isMember(channelId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await db
    .from("channel_memberships")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

async function notify(input: {
  recipientIds: string[];
  actorId: string;
  channelId: string;
  postId: string;
  commentId?: string;
  type: "comment" | "creator_response" | "status_change" | "used_on_stream";
  body: string;
}) {
  const recipients = [...new Set(input.recipientIds)].filter((id) => id && id !== input.actorId);
  if (recipients.length === 0) return;
  await db.from("community_notifications").insert(recipients.map((recipientId) => ({
    recipient_id: recipientId,
    actor_id: input.actorId,
    channel_id: input.channelId,
    post_id: input.postId,
    comment_id: input.commentId,
    type: input.type,
    body: input.body,
  })));
}

export async function communityV2Routes(server: FastifyInstance) {
  server.get<{ Params: { slug: string }; Querystring: { type?: string } }>(
    "/channels/:slug/community-v2",
    async (request, reply) => {
      const channel = await getChannelBySlug(request.params.slug);
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      if (request.query.type && !POST_TYPES.has(request.query.type)) {
        return reply.status(400).send({ error: "Invalid community post type" });
      }
      const userId = await optionalUserId(request.headers.authorization);
      let query = db
        .from("community_posts")
        .select("*, channels!channel_id ( slug ), users!author_id ( display_name, avatar_url ), community_votes ( user_id ), community_comments ( id )")
        .eq("channel_id", channel.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (request.query.type) query = query.eq("type", request.query.type);
      const { data: rows, error } = await query;
      if (error) return reply.status(500).send({ error: "Failed to fetch community" });
      const [{ count: memberCount }, member] = await Promise.all([
        db.from("channel_memberships").select("*", { count: "exact", head: true }).eq("channel_id", channel.id),
        isMember(channel.id, userId),
      ]);
      return reply.send({
        posts: rankPosts((rows ?? []).map((row: any) => shapePost(row, userId))),
        is_member: member,
        member_count: memberCount ?? 0,
        is_owner: userId === channel.owner_id,
      });
    },
  );

  server.get<{ Params: { slug: string } }>(
    "/channels/:slug/community-summary",
    async (request, reply) => {
      const channel = await getChannelBySlug(request.params.slug);
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      const userId = await optionalUserId(request.headers.authorization);
      const [{ count: memberCount, error }, member] = await Promise.all([
        db.from("channel_memberships").select("*", { count: "exact", head: true }).eq("channel_id", channel.id),
        isMember(channel.id, userId),
      ]);
      if (error) return reply.status(500).send({ error: "Failed to fetch community summary" });
      return reply.send({
        is_member: member,
        member_count: memberCount ?? 0,
        is_owner: userId === channel.owner_id,
      });
    },
  );

  server.get(
    "/community/subscriptions",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data, error } = await db
        .from("channel_memberships")
        .select("channel_id")
        .eq("user_id", request.user.id);
      if (error) return reply.status(500).send({ error: "Failed to fetch subscriptions" });
      return reply.send({ channel_ids: (data ?? []).map((membership: any) => membership.channel_id) });
    },
  );

  server.post<{
    Params: { slug: string };
    Body: { type: string; title: string; body?: string; media_url?: string; session_id?: string };
  }>(
    "/channels/:slug/community-v2",
    { preHandler: authenticate, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const channel = await getChannelBySlug(request.params.slug);
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      const { type, title, body, media_url, session_id } = request.body;
      if (!POST_TYPES.has(type)) return reply.status(400).send({ error: "Invalid post type" });
      const cleanTitle = title?.trim();
      const cleanBody = body?.trim();
      if (!cleanTitle || cleanTitle.length > 120 || (cleanBody?.length ?? 0) > 2000) {
        return reply.status(400).send({ error: "Title or body is invalid" });
      }
      const member = await isMember(channel.id, request.user.id);
      if (!member && channel.owner_id !== request.user.id) {
        return reply.status(403).send({ error: "Subscribe to this channel before posting" });
      }
      if (session_id) {
        const { data: session } = await db.from("live_sessions").select("id").eq("id", session_id).eq("channel_id", channel.id).maybeSingle();
        if (!session) return reply.status(400).send({ error: "Session does not belong to this channel" });
      }
      const { data: row, error } = await db
        .from("community_posts")
        .insert({ channel_id: channel.id, author_id: request.user.id, type, title: cleanTitle, body: cleanBody || null, media_url, session_id })
        .select("*, channels!channel_id ( slug ), users!author_id ( display_name, avatar_url ), community_votes ( user_id ), community_comments ( id )")
        .single();
      if (error) return reply.status(500).send({ error: "Failed to create post" });
      return reply.status(201).send({ post: shapePost(row, request.user.id) });
    },
  );

  server.post<{ Params: { slug: string } }>(
    "/channels/:slug/membership",
    { preHandler: authenticate },
    async (request, reply) => {
      const channel = await getChannelBySlug(request.params.slug);
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      if (channel.owner_id === request.user.id) {
        return reply.status(409).send({ error: "You already own this channel" });
      }
      const { error } = await db.from("channel_memberships").upsert({
        channel_id: channel.id,
        user_id: request.user.id,
      }, { onConflict: "channel_id,user_id" });
      if (error) return reply.status(500).send({ error: "Failed to subscribe" });
      return reply.send({ joined: true, subscribed: true });
    },
  );

  server.delete<{ Params: { slug: string } }>(
    "/channels/:slug/membership",
    { preHandler: authenticate },
    async (request, reply) => {
      const channel = await getChannelBySlug(request.params.slug);
      if (!channel) return reply.status(404).send({ error: "Channel not found" });
      await db.from("channel_memberships").delete().eq("channel_id", channel.id).eq("user_id", request.user.id);
      return reply.send({ joined: false, subscribed: false });
    },
  );

  server.get<{ Params: { postId: string } }>(
    "/community/posts/:postId/detail",
    async (request, reply) => {
      const userId = await optionalUserId(request.headers.authorization);
      const { data: row } = await db
        .from("community_posts")
        .select("*, channels!channel_id ( slug, owner_id ), users!author_id ( display_name, avatar_url ), community_votes ( user_id ), community_comments ( id )")
        .eq("id", request.params.postId)
        .maybeSingle();
      if (!row) return reply.status(404).send({ error: "Post not found" });
      const [{ data: commentRows }, { data: eventRows }, member] = await Promise.all([
        db.from("community_comments").select("*, users!author_id ( display_name, avatar_url )").eq("post_id", row.id).order("created_at"),
        db.from("community_post_events").select("*, users!actor_id ( display_name )").eq("post_id", row.id).order("created_at"),
        isMember(row.channel_id, userId),
      ]);
      return reply.send({
        post: shapePost(row, userId),
        comments: (commentRows ?? []).map((comment: any) => ({
          id: comment.id,
          post_id: comment.post_id,
          author_id: comment.author_id,
          author_display_name: comment.users?.display_name ?? "Unknown",
          author_avatar_url: comment.users?.avatar_url ?? null,
          body: comment.body,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        })),
        events: (eventRows ?? []).map((event: any) => ({
          id: event.id,
          post_id: event.post_id,
          actor_id: event.actor_id,
          actor_display_name: event.users?.display_name ?? "Creator",
          event_type: event.event_type,
          from_status: event.from_status,
          to_status: event.to_status,
          session_id: event.session_id,
          created_at: event.created_at,
        })),
        is_member: member,
        is_owner: userId === row.channels?.owner_id,
      });
    },
  );

  server.post<{ Params: { postId: string }; Body: { body: string } }>(
    "/community/posts/:postId/comments",
    { preHandler: authenticate, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const cleanBody = request.body.body?.trim();
      if (!cleanBody || cleanBody.length > 2000) return reply.status(400).send({ error: "Comment is invalid" });
      const { data: post } = await db
        .from("community_posts")
        .select("id, title, author_id, channel_id, channels!channel_id ( owner_id )")
        .eq("id", request.params.postId)
        .maybeSingle();
      if (!post) return reply.status(404).send({ error: "Post not found" });
      const ownerId = post.channels?.owner_id as string;
      if (!(await isMember(post.channel_id, request.user.id)) && ownerId !== request.user.id) {
        return reply.status(403).send({ error: "Subscribe to this channel before replying" });
      }
      const { data: comment, error } = await db
        .from("community_comments")
        .insert({ post_id: post.id, author_id: request.user.id, body: cleanBody })
        .select("*, users!author_id ( display_name, avatar_url )")
        .single();
      if (error) return reply.status(500).send({ error: "Failed to add comment" });
      await db.from("community_posts").update({ updated_at: new Date().toISOString() }).eq("id", post.id);
      await notify({
        recipientIds: [post.author_id, ownerId],
        actorId: request.user.id,
        channelId: post.channel_id,
        postId: post.id,
        commentId: comment.id,
        type: "comment",
        body: `New reply on “${post.title}”`,
      });
      return reply.status(201).send({
        comment: {
          id: comment.id,
          post_id: comment.post_id,
          author_id: comment.author_id,
          author_display_name: comment.users?.display_name ?? "Unknown",
          author_avatar_url: comment.users?.avatar_url ?? null,
          body: comment.body,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        },
      });
    },
  );

  server.post<{
    Params: { postId: string };
    Body: { response?: string; status?: CommunityPostStatus; session_id?: string };
  }>(
    "/community/posts/:postId/creator-action",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: post } = await db
        .from("community_posts")
        .select("id, title, author_id, channel_id, status, channels!channel_id ( owner_id )")
        .eq("id", request.params.postId)
        .maybeSingle();
      if (!post) return reply.status(404).send({ error: "Post not found" });
      if (post.channels?.owner_id !== request.user.id) return reply.status(403).send({ error: "Only the channel owner can do that" });

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const events: any[] = [];
      const response = request.body.response?.trim();
      if (response !== undefined) {
        if (!response || response.length > 2000) return reply.status(400).send({ error: "Creator response is invalid" });
        updates.creator_response = response;
        events.push({ post_id: post.id, actor_id: request.user.id, event_type: "creator_response" });
      }

      let nextStatus = request.body.status;
      if (request.body.session_id) nextStatus = "planned";
      if (nextStatus) {
        if (!POST_STATUSES.has(nextStatus)) return reply.status(400).send({ error: "Invalid status" });
        if (nextStatus !== post.status && !ALLOWED_TRANSITIONS[post.status as CommunityPostStatus].includes(nextStatus)) {
          return reply.status(409).send({ error: `Cannot move from ${post.status} to ${nextStatus}` });
        }
        updates.status = nextStatus;
        if (nextStatus !== post.status) {
          events.push({
            post_id: post.id,
            actor_id: request.user.id,
            event_type: "status_change",
            from_status: post.status,
            to_status: nextStatus,
            session_id: request.body.session_id,
          });
        }
      }

      if (request.body.session_id) {
        const { data: session } = await db
          .from("live_sessions")
          .select("id")
          .eq("id", request.body.session_id)
          .eq("channel_id", post.channel_id)
          .neq("status", "ended")
          .maybeSingle();
        if (!session) return reply.status(400).send({ error: "No active matching session" });
        const { count } = await db.from("show_rundown_items").select("*", { count: "exact", head: true }).eq("session_id", session.id);
        await db.from("show_rundown_items").upsert({
          session_id: session.id,
          post_id: post.id,
          position: count ?? 0,
          state: "planned",
        }, { onConflict: "session_id,post_id" });
        events.push({
          post_id: post.id,
          actor_id: request.user.id,
          event_type: "added_to_rundown",
          from_status: post.status,
          to_status: "planned",
          session_id: session.id,
        });
      }

      const { error } = await db.from("community_posts").update(updates).eq("id", post.id);
      if (error) return reply.status(500).send({ error: "Failed to update post" });
      if (events.length) await db.from("community_post_events").insert(events);
      if (response !== undefined) {
        await notify({
          recipientIds: [post.author_id], actorId: request.user.id, channelId: post.channel_id, postId: post.id,
          type: "creator_response", body: `The creator replied to “${post.title}”`,
        });
      }
      if (nextStatus && nextStatus !== post.status) {
        await notify({
          recipientIds: [post.author_id], actorId: request.user.id, channelId: post.channel_id, postId: post.id,
          type: "status_change", body: `“${post.title}” is now ${nextStatus}`,
        });
      }
      return reply.send({ updated: true, status: nextStatus ?? post.status });
    },
  );

  server.get(
    "/channels/mine/community-inbox",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: channel } = await db.from("channels").select("id, slug").eq("owner_id", request.user.id).maybeSingle();
      if (!channel) return reply.send({ posts: [] });
      const { data: rows } = await db
        .from("community_posts")
        .select("*, channels!channel_id ( slug ), users!author_id ( display_name, avatar_url ), community_votes ( user_id ), community_comments ( id )")
        .eq("channel_id", channel.id)
        .in("status", ["open", "shortlisted", "planned"])
        .order("updated_at", { ascending: false })
        .limit(30);
      return reply.send({ posts: rankPosts((rows ?? []).map((row: any) => shapePost(row, request.user.id))) });
    },
  );

  server.get<{ Params: { sessionId: string } }>(
    "/sessions/:sessionId/rundown",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: session } = await db
        .from("live_sessions")
        .select("id, channels!channel_id ( owner_id )")
        .eq("id", request.params.sessionId)
        .maybeSingle();
      if (!session) return reply.status(404).send({ error: "Session not found" });
      if (session.channels?.owner_id !== request.user.id) return reply.status(403).send({ error: "Forbidden" });
      const { data: rows } = await db
        .from("show_rundown_items")
        .select("*, community_posts!post_id ( title, creator_response, users!author_id ( display_name ), community_votes ( user_id ), community_comments ( id ) )")
        .eq("session_id", session.id)
        .order("position")
        .order("added_at");
      const items: CommunityRundownItem[] = (rows ?? []).map((row: any) => ({
        id: row.id,
        session_id: row.session_id,
        post_id: row.post_id,
        position: row.position,
        state: row.state,
        title: row.community_posts?.title ?? "Untitled idea",
        author_display_name: row.community_posts?.users?.display_name ?? "Unknown",
        vote_count: (row.community_posts?.community_votes ?? []).length,
        comment_count: (row.community_posts?.community_comments ?? []).length,
        creator_response: row.community_posts?.creator_response ?? null,
        added_at: row.added_at,
        used_at: row.used_at,
      }));
      return reply.send({ items });
    },
  );

  server.post<{ Params: { sessionId: string; itemId: string } }>(
    "/sessions/:sessionId/rundown/:itemId/use",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: row } = await db
        .from("show_rundown_items")
        .select("id, post_id, session_id, community_posts!post_id ( title, author_id, channel_id, status, channels!channel_id ( owner_id ) )")
        .eq("id", request.params.itemId)
        .eq("session_id", request.params.sessionId)
        .maybeSingle();
      if (!row) return reply.status(404).send({ error: "Rundown item not found" });
      const post = row.community_posts;
      if (post?.channels?.owner_id !== request.user.id) return reply.status(403).send({ error: "Forbidden" });
      const { data: targetSession } = await db.from("live_sessions").select("channels!inner(owner_id)").eq("id", request.params.sessionId).single();
      if (targetSession?.channels?.owner_id !== request.user.id) return reply.status(403).send({ error: "Forbidden" });
      const usedAt = new Date().toISOString();
      await Promise.all([
        db.from("show_rundown_items").update({ state: "used", used_at: usedAt }).eq("id", row.id),
        db.from("community_posts").update({ status: "used", updated_at: usedAt }).eq("id", row.post_id),
        db.from("community_post_events").insert({
          post_id: row.post_id,
          actor_id: request.user.id,
          event_type: "used_on_stream",
          from_status: post.status,
          to_status: "used",
          session_id: row.session_id,
        }),
      ]);
      await notify({
        recipientIds: [post.author_id], actorId: request.user.id, channelId: post.channel_id, postId: row.post_id,
        type: "used_on_stream", body: `Your idea “${post.title}” was used on stream`,
      });
      return reply.send({ used: true, used_at: usedAt });
    },
  );

  server.get(
    "/community/notifications",
    { preHandler: authenticate },
    async (request, reply) => {
      const { data: rows } = await db
        .from("community_notifications")
        .select("id, post_id, type, body, read_at, created_at, channels!channel_id ( slug, display_name )")
        .eq("recipient_id", request.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return reply.send({
        notifications: (rows ?? []).map((row: any) => ({
          id: row.id,
          channel_slug: row.channels?.slug ?? "",
          channel_display_name: row.channels?.display_name ?? "DITCH",
          post_id: row.post_id,
          type: row.type,
          body: row.body,
          read_at: row.read_at,
          created_at: row.created_at,
        })),
      });
    },
  );

  server.patch<{ Body: { ids?: string[] } }>(
    "/community/notifications/read",
    { preHandler: authenticate },
    async (request, reply) => {
      let query = db.from("community_notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", request.user.id).is("read_at", null);
      if (request.body.ids?.length) query = query.in("id", request.body.ids.slice(0, 50));
      await query;
      return reply.send({ updated: true });
    },
  );
}
