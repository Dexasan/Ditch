import type { FastifyInstance } from "fastify";
import type { Database } from "@ditch/db";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";
import {
  assertChannelOwner,
  assertSessionOwner,
  assertSavedDestinationOwner,
} from "../lib/guards";

type SavedDestinationRow = Database["public"]["Tables"]["saved_destinations"]["Row"];
type StreamPlatform = Database["public"]["Enums"]["stream_platform"];

// Blocks private/loopback addresses to prevent SSRF via ffmpeg. Matches IPv4
// private ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x) and "localhost".
const PRIVATE_HOST =
  /^rtmps?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;

function stripCredentials(dest: SavedDestinationRow) {
  const { rtmp_url: _r, stream_key: _s, ...safe } = dest;
  return safe;
}

export async function savedDestinationRoutes(server: FastifyInstance) {
  /**
   * GET /saved-destinations?channel_id=
   *
   * Returns the channel's persistent destinations. Owner only.
   * RTMP credentials are stripped.
   */
  server.get<{ Querystring: { channel_id: string } }>(
    "/saved-destinations",
    {
      preHandler: authenticate,
      schema: {
        querystring: {
          type: "object",
          required: ["channel_id"],
          properties: { channel_id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const { channel_id } = request.query;
      const userId = request.user.id;

      const channel = await assertChannelOwner(userId, channel_id, reply);
      if (!channel) return;

      const { data, error } = await supabaseAdmin!
        .from("saved_destinations")
        .select("*")
        .eq("channel_id", channel_id)
        .order("created_at", { ascending: true });

      if (error) {
        return reply.status(500).send({ error: "Failed to fetch saved destinations" });
      }

      return reply.status(200).send({
        saved_destinations: (data ?? []).map(stripCredentials),
      });
    }
  );

  /**
   * POST /saved-destinations
   *
   * Persists a destination on a channel the authenticated user owns.
   *
   * Body:   { channel_id, platform, rtmp_url, stream_key, label? }
   * Return: 201 { saved_destination } — RTMP credentials stripped
   */
  server.post<{
    Body: {
      channel_id: string;
      platform: StreamPlatform;
      rtmp_url: string;
      stream_key: string;
      label?: string;
      channel_ref?: string;
    };
  }>(
    "/saved-destinations",
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: "object",
          required: ["channel_id", "platform", "rtmp_url", "stream_key"],
          properties: {
            channel_id: { type: "string", format: "uuid" },
            platform: { type: "string", enum: ["twitch", "youtube", "tiktok", "kick", "ditch"] },
            rtmp_url: { type: "string", pattern: "^rtmps?://.+" },
            stream_key: { type: "string", minLength: 1, maxLength: 512, pattern: "^[^|\\[\\]]+$" },
            label: { type: "string", maxLength: 100 },
            // Channel identity for chat ingestion (Twitch login / YouTube id or @handle).
            channel_ref: { type: "string", maxLength: 100, pattern: "^[^|\\[\\]]*$" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { channel_id, platform, rtmp_url, stream_key, label, channel_ref } = request.body;
      const userId = request.user.id;

      if (PRIVATE_HOST.test(rtmp_url)) {
        return reply.status(422).send({ error: "RTMP URL must point to a public host" });
      }

      const channel = await assertChannelOwner(userId, channel_id, reply);
      if (!channel) return;

      const { data: saved, error } = await supabaseAdmin!
        .from("saved_destinations")
        .insert({
          channel_id,
          platform,
          rtmp_url,
          stream_key,
          label: label ?? null,
          channel_ref: channel_ref?.trim() || null,
        })
        .select()
        .single();

      if (error || !saved) {
        return reply.status(500).send({ error: "Failed to save destination" });
      }

      return reply.status(201).send({ saved_destination: stripCredentials(saved) });
    }
  );

  /**
   * DELETE /saved-destinations/:id
   *
   * Removes a persistent destination. Owner only.
   * Return: 204 No Content
   */
  server.delete<{ Params: { id: string } }>(
    "/saved-destinations/:id",
    {
      preHandler: authenticate,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      const existing = await assertSavedDestinationOwner(userId, id, reply);
      if (!existing) return;

      const { error } = await supabaseAdmin!
        .from("saved_destinations")
        .delete()
        .eq("id", id);

      if (error) {
        return reply.status(500).send({ error: "Failed to delete saved destination" });
      }

      return reply.status(204).send();
    }
  );

  /**
   * POST /sessions/:id/apply-destinations
   *
   * Copies the selected saved destinations into stream_destinations for the
   * session, replacing any existing rows. Called right before going live so
   * the relay (which reads stream_destinations by session_id) streams only to
   * the destinations the creator enabled for this broadcast.
   *
   * Body:   { saved_destination_ids: string[] }
   * Return: 200 { count }
   */
  server.post<{
    Params: { id: string };
    Body: { saved_destination_ids: string[] };
  }>(
    "/sessions/:id/apply-destinations",
    {
      preHandler: authenticate,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["saved_destination_ids"],
          properties: {
            saved_destination_ids: {
              type: "array",
              items: { type: "string", format: "uuid" },
              minItems: 1,
              maxItems: 20,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id: sessionId } = request.params;
      const { saved_destination_ids } = request.body;
      const userId = request.user.id;

      const session = await assertSessionOwner(userId, sessionId, reply);
      if (!session) return;

      if (session.status === "ended") {
        return reply.status(422).send({ error: "Cannot configure an ended session" });
      }

      // Fetch the selected saved destinations, scoped to this session's channel
      // so a caller can't splice in another channel's rows by id.
      const { data: saved, error: fetchErr } = await supabaseAdmin!
        .from("saved_destinations")
        .select("platform, rtmp_url, stream_key, channel_ref")
        .eq("channel_id", session.channel_id)
        .in("id", saved_destination_ids);

      if (fetchErr) {
        return reply.status(500).send({ error: "Failed to load saved destinations" });
      }
      if (!saved?.length) {
        return reply.status(422).send({ error: "No matching saved destinations" });
      }

      // Replace the session's destinations with the current selection.
      const { error: delErr } = await supabaseAdmin!
        .from("stream_destinations")
        .delete()
        .eq("session_id", sessionId);

      if (delErr) {
        return reply.status(500).send({ error: "Failed to reset session destinations" });
      }

      const rows = saved.map((s) => ({
        session_id: sessionId,
        platform: s.platform,
        rtmp_url: s.rtmp_url,
        stream_key: s.stream_key,
        channel_ref: s.channel_ref,
      }));

      const { error: insErr } = await supabaseAdmin!
        .from("stream_destinations")
        .insert(rows);

      if (insErr) {
        return reply.status(500).send({ error: "Failed to apply destinations" });
      }

      return reply.status(200).send({ count: rows.length });
    }
  );
}
