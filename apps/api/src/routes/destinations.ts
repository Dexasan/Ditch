import type { FastifyInstance } from "fastify";
import type { Database } from "@ditch/db";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";
import { assertSessionOwner, assertChannelOwner, assertDestinationOwner } from "../lib/guards";

type DestinationRow = Database["public"]["Tables"]["stream_destinations"]["Row"];
type StreamPlatform = Database["public"]["Enums"]["stream_platform"];
type DestinationStatus = Database["public"]["Enums"]["destination_status"];

function stripCredentials(dest: DestinationRow) {
  const { rtmp_url: _r, stream_key: _s, ...safe } = dest;
  return safe;
}

export async function destinationRoutes(server: FastifyInstance) {
  /**
   * POST /destinations
   *
   * Adds an RTMP destination to a session the authenticated user owns.
   * Rejects if the session is already ended.
   *
   * Body:   { session_id, platform, rtmp_url, stream_key }
   * Return: 201 { destination } — RTMP credentials stripped
   */
  server.post<{
    Body: {
      session_id: string;
      platform: StreamPlatform;
      rtmp_url: string;
      stream_key: string;
    };
  }>(
    "/destinations",
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: "object",
          required: ["session_id", "platform", "rtmp_url", "stream_key"],
          properties: {
            session_id: { type: "string", format: "uuid" },
            platform: { type: "string", enum: ["twitch", "youtube", "tiktok", "kick", "ditch"] },
            rtmp_url: { type: "string", pattern: "^rtmps?://.+" },
            stream_key: { type: "string", minLength: 1, maxLength: 512, pattern: "^[^|\\[\\]]+$" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { session_id, platform, rtmp_url, stream_key } = request.body;
      const userId = request.user.id;

      // Block private/loopback addresses to prevent SSRF via ffmpeg.
      // Regex matches IPv4 private ranges (10.x, 172.16-31.x, 192.168.x,
      // 127.x, 169.254.x) and the bare word "localhost".
      const PRIVATE_HOST = /^rtmps?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;
      if (PRIVATE_HOST.test(rtmp_url)) {
        return reply.status(422).send({ error: "RTMP URL must point to a public host" });
      }

      const session = await assertSessionOwner(userId, session_id, reply);
      if (!session) return;

      if (session.status === "ended") {
        return reply.status(422).send({ error: "Cannot add a destination to an ended session" });
      }

      const { data: destination, error } = await supabaseAdmin!
        .from("stream_destinations")
        .insert({ session_id, platform, rtmp_url, stream_key })
        .select()
        .single();

      if (error || !destination) {
        return reply.status(500).send({ error: "Failed to create destination" });
      }

      return reply.status(201).send({ destination: stripCredentials(destination) });
    }
  );

  /**
   * GET /destinations?channel_id=
   *
   * Returns all destinations for the active (non-ended) session on a channel.
   * Auth required — only the channel owner can read RTMP destination records.
   * Returns an empty array if no active session exists.
   *
   * Return: 200 { destinations } — RTMP credentials stripped
   */
  server.get<{ Querystring: { channel_id: string } }>(
    "/destinations",
    {
      preHandler: authenticate,
      schema: {
        querystring: {
          type: "object",
          required: ["channel_id"],
          properties: {
            channel_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { channel_id } = request.query;
      const userId = request.user.id;

      const channel = await assertChannelOwner(userId, channel_id, reply);
      if (!channel) return;

      const { data: session } = await supabaseAdmin!
        .from("live_sessions")
        .select("id")
        .eq("channel_id", channel_id)
        .neq("status", "ended")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) {
        return reply.status(200).send({ destinations: [] });
      }

      const { data: destinations, error } = await supabaseAdmin!
        .from("stream_destinations")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (error) {
        return reply.status(500).send({ error: "Failed to fetch destinations" });
      }

      return reply.status(200).send({
        destinations: (destinations ?? []).map(stripCredentials),
      });
    }
  );

  /**
   * PATCH /destinations/:id
   *
   * Updates the status of a destination (e.g. connecting → live, live → error).
   *
   * Body:   { status: DestinationStatus }
   * Return: 200 { destination } — RTMP credentials stripped
   */
  server.patch<{
    Params: { id: string };
    Body: { status: DestinationStatus };
  }>(
    "/destinations/:id",
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
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["connecting", "live", "error", "stopped"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;
      const userId = request.user.id;

      const existing = await assertDestinationOwner(userId, id, reply);
      if (!existing) return;

      const { data: destination, error } = await supabaseAdmin!
        .from("stream_destinations")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error || !destination) {
        return reply.status(500).send({ error: "Failed to update destination" });
      }

      return reply.status(200).send({ destination: stripCredentials(destination) });
    }
  );

  /**
   * DELETE /destinations/:id
   *
   * Removes a destination from a session.
   *
   * Return: 204 No Content
   */
  server.delete<{ Params: { id: string } }>(
    "/destinations/:id",
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

      const existing = await assertDestinationOwner(userId, id, reply);
      if (!existing) return;

      const { error } = await supabaseAdmin!
        .from("stream_destinations")
        .delete()
        .eq("id", id);

      if (error) {
        return reply.status(500).send({ error: "Failed to delete destination" });
      }

      return reply.status(204).send();
    }
  );
}
