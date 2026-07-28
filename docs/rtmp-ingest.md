# External RTMP ingest

DITCH can accept a session-scoped RTMP feed from OBS or a hardware encoder and fan it out through the same destination and HLS pipeline used by the browser studio.

## Creator flow

1. Create an idle session in the dashboard.
2. Enable the destinations for the broadcast.
3. Choose **Use OBS / encoder**.
4. Copy the displayed server URL and stream key into the encoder.
5. Start the encoder. DITCH marks the session live only after the relay accepts the publisher.
6. Stop the encoder to end the session, or use **Force end** in DITCH.

The stream key is signed for one session and expires after 12 hours by default. DITCH does not persist the raw key.

## Encoder profile

Use H.264 video, AAC audio, and a two-second keyframe interval. The relay copies the incoming codecs to avoid an extra quality-losing encode.

## Deployment

Apply `supabase/migrations/009_session_source.sql` before deploying the API, web app, and relay.

Set these variables on both the API and relay where applicable:

```env
RTMP_INGEST_ENABLED=true
RTMP_INGEST_PORT=1935
INGEST_PUBLIC_URL=rtmp://ingest.example.com:1935/live
INGEST_AUTH_SECRET=<at-least-32-random-characters>
INGEST_KEY_TTL_SECONDS=43200
```

`INGEST_AUTH_SECRET` must be identical on the API and relay. Expose the relay's raw TCP port configured by `RTMP_INGEST_PORT`; the existing HTTP/WebSocket service remains on port 3003. If the infrastructure terminates RTMPS in front of the relay, use the public `rtmps://` address in `INGEST_PUBLIC_URL`.

The relay health response exposes `rtmp_ingest_enabled` and `active_ingests` for operational checks.