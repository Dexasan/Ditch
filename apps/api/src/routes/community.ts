import type { FastifyInstance } from "fastify";
import type { CommunityPostType } from "@ditch/types";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

type PostType = CommunityPostType;

function shapePosts(rows: any[], userId: string | null) {
  return rows
    .map((r) => ({
      id:                   r.id,
      channel_id:           r.channel_id,
      author_id:            r.author_id,
      author_display_name:  r.users?.display_name ?? "Unknown",
      type:                 r.type as PostType,
      title:                r.title,
      body:                 r.body ?? null,
      media_url:            r.media_url ?? null,
      session_id:           r.session_id ?? null,
      is_pinned:            r.is_pinned,
      vote_count:           (r.community_votes ?? []).length,
      user_voted:           userId
        ? (r.community_votes ?? []).some((v: any) => v.user_id === userId)
        : false,
      created_at:           r.created_at,
    }))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.vote_count - a.vote_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export async function communityRoutes(server: FastifyInstance) {
  /**
   * GET /channels/:slug/community
   *
   * Public. Returns community posts for a channel, sorted pinned-first
   * then by vote count. Optional ?type= filter.
   *
   * Return: 200 { posts: CommunityPost[] }
   */
  server.get<{
    Params:      { slug: string };
    Querystring: { type?: PostType };
  }>(
    "/channels/:slug/community",
    async (request, reply) => {
      const { slug } = request.params;
      const { type }  = request.query;

      // Resolve channel
      const { data: channel, error: chanErr } = await supabaseAdmin!
        .from("channels")
        .select("id")
        .eq("slug", slug)
        .single();

      if (chanErr || !channel) return reply.status(404).send({ error: "Channel not found" });

      // Resolve optional caller identity (no hard auth requirement)
      let userId: string | null = null;
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const { data: { user } } = await supabaseAdmin!.auth.getUser(
          authHeader.slice(7)
        );
        userId = user?.id ?? null;
      }

      let query = supabaseAdmin!
        .from("community_posts")
        .select("*, users!author_id ( display_name ), community_votes ( user_id )")
        .eq("channel_id", channel.id)
        .limit(50);

      if (type) query = query.eq("type", type);

      const { data: rows, error } = await query;
      if (error) return reply.status(500).send({ error: "Failed to fetch posts" });

      return reply.send({ posts: shapePosts(rows ?? [], userId) });
    }
  );

  /**
   * POST /channels/:slug/community
   *
   * Authenticated. Creates a post.
   *
   * Body:   { type, title, body?, media_url?, session_id? }
   * Return: 201 { post: CommunityPost }
   */
  server.post<{
    Params: { slug: string };
    Body: {
      type:        PostType;
      title:       string;
      body?:       string;
      media_url?:  string;
      session_id?: string;
    };
  }>(
    "/channels/:slug/community",
    { preHandler: authenticate },
    async (request, reply) => {
      const { slug } = request.params;
      const { type, title, body, media_url, session_id } = request.body;
      const author_id = request.user.id;

      const { data: channel, error: chanErr } = await supabaseAdmin!
        .from("channels")
        .select("id")
        .eq("slug", slug)
        .single();

      if (chanErr || !channel) return reply.status(404).send({ error: "Channel not found" });

      const { data: row, error } = await supabaseAdmin!
        .from("community_posts")
        .insert({ channel_id: channel.id, author_id, type, title, body, media_url, session_id })
        .select("*, users!author_id ( display_name ), community_votes ( user_id )")
        .single();

      if (error) return reply.status(500).send({ error: "Failed to create post" });

      const [post] = shapePosts([row], author_id);
      return reply.status(201).send({ post });
    }
  );

  /**
   * POST /community/posts/:postId/vote
   *
   * Authenticated. Toggles vote on a post — votes if not voted, unvotes if voted.
   *
   * Return: 200 { voted: boolean, vote_count: number }
   */
  server.post<{ Params: { postId: string } }>(
    "/community/posts/:postId/vote",
    { preHandler: authenticate },
    async (request, reply) => {
      const { postId } = request.params;
      const userId     = request.user.id;

      const { data: existing } = await supabaseAdmin!
        .from("community_votes")
        .select("user_id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin!
          .from("community_votes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
      } else {
        await supabaseAdmin!
          .from("community_votes")
          .insert({ post_id: postId, user_id: userId });
      }

      // Return fresh vote count
      const { count } = await supabaseAdmin!
        .from("community_votes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);

      return reply.send({ voted: !existing, vote_count: count ?? 0 });
    }
  );

  /**
   * GET /channels/mine/suggestions
   *
   * Authenticated. Returns top suggestions for the creator's own channel.
   * Used by the dashboard widget.
   *
   * Return: 200 { suggestions: CommunityPost[] }
   */
  server.get(
    "/channels/mine/suggestions",
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = request.user.id;

      const { data: channel } = await supabaseAdmin!
        .from("channels")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();

      if (!channel) return reply.send({ suggestions: [] });

      const { data: rows } = await supabaseAdmin!
        .from("community_posts")
        .select("*, users!author_id ( display_name ), community_votes ( user_id )")
        .eq("channel_id", channel.id)
        .eq("type", "suggestion")
        .limit(20);

      const posts = shapePosts(rows ?? [], userId);
      return reply.send({ suggestions: posts.slice(0, 5) });
    }
  );
}
