# DITCH performance and reliability baseline

This document defines the first optimization gate. It separates application
loading, browser composition, relay startup, destination startup, and recovery
so a slow result can be assigned to the correct part of the system.

## Current automated coverage

Run:

```bash
pnpm --filter @ditch/web test:graphics-only-stream
pnpm --filter @ditch/web test:mobile-audience
pnpm --filter @ditch/web test:relay-reliability
pnpm --filter @ditch/web type-check
pnpm --filter @ditch/relay type-check
```

The relay check protects these properties:

- only one reconnect timer can be pending;
- a failed connection is closed before another is opened;
- permanent auth/configuration errors are not retried;
- browser WebSocket buffering is bounded at 4 MiB;
- ffmpeg stdin backpressure pauses and resumes relay WebSocket reads;
- startup phase and first-media timing fields remain available.

## Initial performance budgets

These are launch gates, not claims about current production results.

| Area | Metric | Initial budget |
| --- | --- | --- |
| Public web | LCP at p75, mobile | <= 2.5 s |
| Public web | INP at p75 | <= 200 ms |
| Public web | CLS at p75 | <= 0.10 |
| Compositor | foreground rolling FPS | >= 29 at a 30 FPS target |
| Compositor | background rolling FPS | >= 29 at a 30 FPS target |
| Relay start | WebSocket open | <= 500 ms |
| Relay start | start request acknowledged | <= 1,500 ms |
| Relay start | first media received by relay | <= 2,000 ms |
| Destination | picture visible after Go Live | <= 6,000 ms |
| Upload health | peak WebSocket buffered bytes | < 1 MiB normally; 4 MiB forces recovery |
| Recovery | ffmpeg exit to first media after reconnect | <= 5,000 ms |
| Recovery | concurrent relay connections for one studio | exactly 1 |

## One production baseline run

Use a real creator session with one test destination.

1. Open the studio and browser console. Filter for `relay-perf` and
   `compositor`.
2. Start the destination's preview, then click Go Live in DITCH.
3. Record `socket_open_ms`, `relay_started_ms`,
   `first_browser_chunk_ms`, `first_relay_media_ms`, the relay phase
   timings, and the time at which the destination first displays a picture.
4. Leave the studio foregrounded for five minutes, then background it for ten
   minutes. Record the five-second compositor FPS samples and two-second
   bitrate samples.
5. Simulate one ffmpeg exit. Confirm there is one reconnect countdown, one new
   relay connection, and one new first-media event.
6. Repeat the start/recovery sequence three times. Use the median for the
   working baseline and retain the worst result as the reliability case.

Record results here:

| Run | Socket open | Relay ack | First browser chunk | First relay media | Destination picture | Reconnect first media | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | - | - | - | - | - | - | |
| 2 | - | - | - | - | - | - | |
| 3 | - | - | - | - | - | - | |

## Reading the timings

- High `socket_open_ms`: relay discovery, DNS, TLS, region distance, or relay
  cold start.
- High relay `auth_ms`: JWKS cache miss or token verification issue.
- High `database_ms`: Supabase latency or slow ownership/destination queries.
- High `hls_setup_ms`: local storage/R2 setup.
- High `first_browser_chunk_ms` after a fast relay acknowledgement: browser
  encoder startup.
- Fast first relay media but slow destination picture: ffmpeg probing,
  transcoding, RTMP handshake, or destination keyframe behavior.
- Rising `peak_socket_buffer_bytes`: upload congestion or a relay/ffmpeg
  consumer that cannot keep up.

Do not begin the WebCodecs migration until these measurements show that browser
encoder startup or keyframe control is the limiting stage. If destination
startup is the only slow stage, capture the first destination-visible time and
keyframe evidence before changing the browser pipeline.
