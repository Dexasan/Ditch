import type { FastifyInstance } from "fastify";
import type { Database } from "@ditch/db";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";

type SavedDestinationRow = Database["public"]["Tables"]["saved_destinations"]["Row"];

function stripCredentials(destination: SavedDestinationRow) {
  const { rtmp_url: _rtmpUrl, stream_key: _streamKey, ...safe } = destination;
  return safe;
}

export async function consoleRoutes(server: FastifyInstance) {
  server.get(
    "/console/bootstrap",
    { preHandler: authenticate },
    async (request, reply) => {
      const db = supabaseAdmin as any;
      const userId = request.user.id;

      const { data: channel, error: channelError } = await db
        .from("channels")
        .select("*")
        .eq("owner_id", userId)
        .maybeSingle();

      if (channelError) {
        return reply.status(500).send({ error: "Failed to load console" });
      }

      if (!channel) {
        return reply.send({
          channel: null,
          session: null,
          saved_destinations: [],
          suggestions: [],
          unread_notifications: 0,
        });
      }

      const [sessionResult, destinationsResult, suggestionsResult, notificationsResult] =
        await Promise.all([
          db
            .from("live_sessions")
            .select("*")
            .eq("channel_id", channel.id)
            .neq("status", "ended")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          db
            .from("saved_destinations")
            .select("*")
            .eq("channel_id", channel.id)
            .order("created_at", { ascending: true }),
          db
            .from("community_posts")
            .select("*, users!author_id ( display_name ), community_votes ( user_id )")
            .eq("channel_id", channel.id)
            .eq("type", "suggestion")
            .order("created_at", { ascending: false })
            .limit(5),
          db
            .from("community_notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .is("read_at", null),
        ]);

      const suggestions = (suggestionsResult.data ?? []).map((row: any) => ({
        id: row.id,
        channel_id: row.channel_id,
        author_id: row.author_id,
        author_display_name: row.users?.display_name ?? "Anonymous",
        type: row.type,
        title: row.title,
        body: row.body,
        media_url: row.media_url,
        session_id: row.session_id,
        is_pinned: row.is_pinned,
        vote_count: row.community_votes?.length ?? 0,
        user_voted: Boolean(
          row.community_votes?.some((vote: { user_id: string }) => vote.user_id === userId),
        ),
        created_at: row.created_at,
      }));

      return reply.send({
        channel,
        session: sessionResult.data ?? null,
        saved_destinations: (destinationsResult.data ?? []).map(stripCredentials),
        suggestions,
        unread_notifications: notificationsResult.count ?? 0,
      });
    },
  );
}
