import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { IngestCredentials } from "@ditch/types";
import { supabaseAdmin } from "@ditch/db";
import { authenticate } from "../lib/authenticate";
import { assertSessionOwner } from "../lib/guards";

const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

function ingestConfig() {
  if (process.env.RTMP_INGEST_ENABLED !== "true") return null;
  const secret = process.env.INGEST_AUTH_SECRET?.trim();
  const serverUrl = process.env.INGEST_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (
    !secret ||
    secret.length < 32 ||
    !serverUrl ||
    !/^rtmps?:\/\/[^?\s]+\/live$/i.test(serverUrl)
  ) return null;
  const configuredTtl = Number(process.env.INGEST_KEY_TTL_SECONDS);
  const ttlSeconds = Number.isFinite(configuredTtl)
    ? Math.min(24 * 60 * 60, Math.max(15 * 60, Math.round(configuredTtl)))
    : DEFAULT_TTL_SECONDS;
  return { secret, serverUrl, ttlSeconds };
}

function signStreamPath(path: string, expires: number, secret: string) {
  return createHash("md5").update(`${path}-${expires}-${secret}`).digest("hex");
}

export async function ingestRoutes(server: FastifyInstance) {
  /**
   * Switches an idle session to RTMP source mode and returns a time-limited
   * publish key. Destinations must already be applied to the session.
   */
  server.post<{ Params: { id: string } }>(
    "/sessions/:id/ingest-credentials",
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
      const config = ingestConfig();
      if (!config) {
        return reply.status(503).send({ error: "RTMP ingest is not configured" });
      }

      const session = await assertSessionOwner(request.user.id, request.params.id, reply);
      if (!session) return;
      if (session.status !== "idle") {
        return reply.status(422).send({ error: "Ingest credentials require an idle session" });
      }

      const { count, error: destinationError } = await supabaseAdmin!
        .from("stream_destinations")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);
      if (destinationError) {
        return reply.status(500).send({ error: "Failed to verify session destinations" });
      }
      if (!count) {
        return reply.status(422).send({
          error: "Select at least one destination before creating an ingest key",
        });
      }

      const { error: updateError } = await supabaseAdmin!
        .from("live_sessions")
        .update({ source_type: "rtmp" })
        .eq("id", session.id);
      if (updateError) {
        return reply.status(500).send({ error: "Failed to arm RTMP ingest" });
      }

      const expires = Math.floor(Date.now() / 1000) + config.ttlSeconds;
      const streamPath = `/live/${session.id}`;
      const signature = signStreamPath(streamPath, expires, config.secret);
      const credentials: IngestCredentials = {
        server_url: config.serverUrl,
        stream_key: `${session.id}?sign=${expires}-${signature}`,
        expires_at: new Date(expires * 1000).toISOString(),
      };
      return reply.send({ credentials });
    },
  );
}