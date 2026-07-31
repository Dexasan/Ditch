# DITCH scaling cost model

**Status: planning estimate, not a commitment.** Every figure here is a modelled
projection at a hypothetical scale DITCH has not reached. The architecture
direction is approved. The budget is not yet trusted, for the reasons recorded in
"Open blockers" and "Revision history" below.

This document exists so that nobody re-derives the optimistic version of these
numbers from scratch. An earlier pass produced a much lower figure by holding
several assumptions that do not survive review.

## Scenario

The reference scenario used throughout:

| Input | Value |
|---|---|
| Creators | 10,000 |
| Session length | 3 h/day, 30 days |
| Session-hours | 900,000/month |
| Viewers per creator | 100 |
| Viewer-hours | 90,000,000/month |
| Average concurrent sessions | 1,250 |
| Peak concurrent sessions (planning) | 5,000 to 6,250 (4x to 5x average) |
| Theoretical maximum concurrency | 10,000 |

Peak is a planning number, not a ceiling. Sizing static capacity for 100 percent
simultaneity of a 3-hour daily behavior over-provisions by roughly 2.5x. The
intended shape is a bare-metal baseline at about 4x average with cloud burst for
the top decile, because bare metal cannot autoscale on the timescale a viral
event demands.

## Bitrate is the dominant input

The whole model scales with program bitrate. `DEFAULT_ENCODER_PARAMS` in
`apps/relay/src/lib/ffmpeg.ts` is currently 3000 kbps video plus 192 kbps audio,
clamped to a 8000 kbps ceiling. 3.2 Mbps is thin for 1080p60 and should not be
used as the quality target.

| Program bitrate | Viewer delivery/month | Relay egress/month (5 copies) |
|---:|---:|---:|
| 3.2 Mbps | 129.6 PB | 6.5 PB |
| 6.2 Mbps | 251 PB | 12.6 PB |
| 8.2 Mbps | 332 PB | 16.6 PB |

"5 copies" is four RTMP destinations plus the HLS push. Peak delivery throughput
at 6.2 Mbps and 500,000 concurrent viewers is roughly 3.1 Tbps, and roughly
6.2 Tbps in the theoretical all-at-once case.

## Where cost actually sits

Per person-hour, at 3.2 Mbps and 1.44 GB/viewer-hour:

| Path | Cost per person-hour | Who is on it |
|---|---|---|
| Agora WebRTC, 720p subscribe | ~$0.24 | creator and participants only |
| Agora WebRTC, 1080p | ~$0.54 | same |
| HLS via a metered CDN | ~$0.03 | nobody, if R2 holds |
| HLS via R2 and Cloudflare | ~$0 | the entire passive audience |
| ffmpeg copy path | ~$0.01 | per session, not per viewer |

Two conclusions follow.

**The passive audience is not the cost driver.** Viewers are already on HLS from
R2 (`ChannelView.tsx`, gated on `NEXT_PUBLIC_HLS_BASE_URL`), and R2 charges no
egress. The 129 to 332 PB delivered to viewers is the cheapest large number in
the model.

**The expensive bytes are the ones that cannot go through Cloudflare.** RTMP
fan-out to platforms and WebRTC fan-out to participants must leave from
infrastructure you rent. On a metered host at $0.05 to $0.10/GB, 12.6 PB of relay
egress costs $630k to $1.26M/month. On bandwidth-inclusive dedicated servers at
about EUR 1/TB it costs about $14k. That single distinction is the largest saving
available and it does not require any architectural change.

## Target architecture

Three planes, three hosting models. The current problem is that all three run on
the same kind of infrastructure.

```
  CREATOR ─────────►  LiveKit SFU (self-hosted)
  PARTICIPANTS ────►  simulcast, tile-matched quality, dynacast
                              │
                              ▼  composited in browser, or OBS via RTMP ingest
                      RELAY FLEET (ffmpeg)
                      bare metal, bandwidth-inclusive
                       │                    │
              RTMP fan-out            HLS segments
                       │                    │
                       ▼                    ▼
            Twitch/YouTube/           R2 ──► Cloudflare CDN ──► viewers
            TikTok/Kick

  CONTROL PLANE (managed): Fastify API, Socket.io + Redis, Supabase, web
```

- **Control plane.** Small, stateful, complex. Keep on managed services. It is a
  rounding error and managed is worth the premium.
- **Media plane.** Large, stateless, simple. ffmpeg transmuxing and an SFU
  forwarding packets. Belongs on bare metal because its cost is bandwidth, and
  bandwidth carries a 20x to 50x markup in metered clouds.
- **Delivery plane.** Large but perfectly cacheable. One stream serves 100
  viewers from identical bytes. Belongs on a CDN with free egress.

The repository already contains real foundations: the RTC provider abstraction
(`useRtcRoom`), OBS ingest (`source_type: "rtmp"`), HLS output, RTMP fan-out, and
a program-feed publish path (`useProgramPublish`). The shape is right. The
implementation is not yet fleet-ready.

## Interactive quality: match the tile, do not flatten to 360p

`useAgoraRoom.ts` hardcodes every participant camera to 1920x1080 regardless of
how much of the canvas that participant occupies. That is the actual waste, and
the fix is not a lower fixed resolution.

The canvas is a fixed pixel budget. What each publisher needs depends on tile
size:

| Layout | Tile size | Source needed | Per publisher | Session total |
|---|---|---|---|---|
| Solo | 1920x1080 | 1080p | 3.0 Mbps | 3.0 |
| 2-up | 960x1080 | 1080p (crop-fill) | 3.0 Mbps | 6.0 |
| 4-grid | 960x540 | 540p | 1.2 Mbps | 4.8 |
| 8-grid | 480x270 | 360p | 0.6 Mbps | 4.8 |

A two-person conversation stays at full 1080p, because tile-matched means it gets
exactly what it needs and what it needs is everything. Savings come from the
many-participant layouts, where 8 publishers currently send 24 Mbps to render
4.8 Mbps of visible pixels.

Useful property: session cost is roughly flat at 3 to 6 Mbps regardless of
participant count, because the canvas caps total pixels. A busy 8-person
participatory stream costs about the same as a 2-person podcast, so the
participation the product is designed to encourage is not financially punished.

The mechanism is already partly present. `useLiveKitRoom.ts` sets
`adaptiveStream: true, dynacast: true` and `useLiveKitCompositePublish.ts` sets
`simulcast: true`. Remaining work is publishing layer sizes that match the actual
layout presets rather than library defaults, and ensuring the compositor's draw
size matches what the video element reports so `adaptiveStream` selects
correctly.

## Adaptive bitrate ladder

A single 3.2 Mbps rendition recreates the "1080p that does not feel HD" problem
and strands viewers on weak connections. A real ladder needs 1080p60, 720p, and
480p or 360p.

`-c:v copy` cannot produce renditions. Something must encode them, and that is a
fleet, not a line item. A four-rung ladder on CPU x264 is roughly 0.9 vCPU per
session on top of the copy path. At 6,000 peak sessions that is about 5,400 vCPU,
roughly 225 additional boxes, about $45k/month. GPU encode is worse at this
shape, not better.

**Ladder on demand rather than universally.** Viewer counts follow a power law.
A session with five viewers does not need four rungs. Gating rendition generation
on concurrent viewers, passthrough-only below roughly 50 and full ladder above,
takes the encoder fleet from about $45k to about $5k if 10 percent of sessions
qualify. This applies the same principle as the rest of the architecture: spend
on what is actually watched. This should be modelled and measured before ABR is
accepted as a fixed cost.

## Cost model

At 6.2 Mbps, peak-ready, with on-demand laddering:

| Line | $/month |
|---|---|
| Relay fleet, 60 to 70 boxes, 12.6 PB egress | ~29,000 |
| SFU fleet, tile-matched | ~8,000 |
| R2 operations and storage (delivery itself $0) | ~18,000 |
| ABR encoders, on-demand | ~5,000 |
| Control plane and observability | ~9,000 |
| Headroom, 20 percent | ~14,000 |
| **Subtotal** | **~83,000** |
| Universal ABR instead of on-demand | ~123,000 |
| Two infrastructure engineers, loaded | +~20,000 |

**Expected planning range: $100k to $145k/month.**

For contrast, the same scenario at 3.2 Mbps, average load, single rendition, and
no operational headcount models at about $52k/month. That figure is the best
possible floor and must not be quoted as an expected production bill.

The equivalent scenario on current hosting, with Agora at list rates and metered
Railway egress, models at roughly $1.1M/month. The migration is worth doing. The
disagreement is only about where it lands.

## Cloudflare is the deciding variable

Every figure above assumes R2 egress remains $0 at 129 to 332 PB/month. R2's
published Internet egress price is genuinely zero, but this volume is not
something to operate on self-service assumptions, and Cloudflare's video guidance
directs large-scale delivery toward Stream or Enterprise Stream Delivery.

Written terms are required covering:

- whether cached R2 HLS delivery is permitted at this volume;
- price per delivered GB, if any;
- sustained and peak throughput allowance up to roughly 3 to 7 Tbps;
- cache topology, tiered caching, and request rate limits;
- support terms and SLA;
- WAF, authentication, and Workers pricing at this request volume.

Sensitivity if Cloudflare charges $0.002/GB:

| Bitrate | Added delivery cost |
|---:|---:|
| 3.2 Mbps | ~$259k/month |
| 6.2 Mbps | ~$502k/month |
| 8.2 Mbps | ~$664k/month |

At that price the delivery layer must be reconsidered entirely. This is the only
input in the model that cannot be derived from the codebase, and it is worth more
than any code change on the list.

## Code findings that block fleet operation

These are correctness and scalability defects, not tuning. They were verified
against the code, and they are the reason "hosting and config migration" is an
inaccurate description of the work.

**HLS uploader rescans all history every second.**
`apps/relay/src/lib/hls.ts` calls `readdir` then `stat` on every file in the
session directory once per second. The scan is O(segments so far), so a 3-hour
stream ends up stat-ing roughly 5,400 files per second. At a few hundred sessions
per box this is a CPU cost inside the same budget used to size the fleet.

**Local segments are never reaped during a stream.**
The ffmpeg HLS output sets `hls_flags=independent_segments+program_date_time`
with no `delete_segments`, and `hls.ts` only removes the directory in `stop()`.
At 3 hours and 6 Mbps that is about 8 GB per session of local disk, which
exhausts filesystem capacity at fleet density.

**Partial segments can be uploaded and marked immutable.**
The uploader can PUT a `.ts` file while ffmpeg is still writing it, with
`CacheControl: public, max-age=3600, immutable`. A CDN can then cache a truncated
segment for an hour.

**Playlist can be uploaded before the segments it references.**
Upload ordering follows `readdir` order, which is not guaranteed and which sorts
`index.m3u8` ahead of `segment-*.ts`. The playlist likely publishes ahead of its
own segments, producing edge 404s.

**Playlist is uncacheable.**
`CacheControl: no-store` on the `.m3u8` means every viewer's playlist poll
reaches R2 directly rather than the edge. At this scale that is on the order of
60,000 requests/second against one bucket, which is an availability problem
before it is a cost problem. The fix is a short edge TTL, but it must be verified
against `cf-cache-status` under load rather than assumed from a header change,
and R2 custom-domain cache eligibility and cache keys need explicit checking.

**Objects are never deleted from R2.**
`stop()` removes the local directory but leaves every segment in the bucket
permanently. Without a lifecycle rule, storage accumulates at 1.3 to 2.5 PB per
month and month 12 costs 12x month 1.

**Relay assignment has no health, capacity, or region awareness.**
`apps/api/src/routes/relay.ts` selects a node with
`stableIndex(session_id, urls.length)` over a static `RELAY_URLS` list. Because
the key is `session_id`, a reconnect deterministically re-picks the same node, so
a dead or full node is a permanent failure for that session rather than a
transient one. This must be fixed before any multi-node load test, because a
saturated node stays saturated and nothing rebalances, which makes the test
unable to produce a meaningful result.

**HLS failure stampedes passive viewers into RTC.**
In `ChannelView.tsx`, a fatal HLS error sets `hlsFailed`, which enables the RTC
room for audience members. At scale a CDN incident migrates hundreds of thousands
of passive viewers onto the SFU fleet, which both collapses the fleet and, on
Agora list pricing, produces a large unplanned bill with no alarm. The fallback
needs a concurrency cap or an explicit flag.

**MediaRecorder fallback sessions are disproportionately expensive.**
The copy path is roughly 0.12 to 0.15 vCPU per session. Sessions that fall back
to MediaRecorder/WebM re-encode through x264 at roughly 2 vCPU. At 10 percent
fallback these dominate relay CPU planning.

**LiveKit parity gaps remain** around anonymous participant credentials,
screen-share audio, and composite quality control.

## Open blockers

The budget cannot be trusted until all five are closed.

1. Obtain the Cloudflare Enterprise answer in writing, covering the terms listed
   above.
2. Define the product targets the model depends on: program bitrate, ABR ladder,
   latency budget, and peak concurrency.
3. Rewrite the HLS uploader (incremental tracking, `delete_segments` plus local
   reaping, completed-segments-only upload, enforced segment-before-playlist
   ordering) and load-test it.
4. Replace the relay scheduler with a health-, capacity-, and region-aware one.
   Prerequisite for step 5.
5. Prove one region under sustained 3-hour load at target bitrate before
   multiplying servers.

## Sensitivities

- **Bitrate.** Bandwidth-driven lines scale linearly. 3.2 Mbps versus 6.2 Mbps is
  roughly a 2x swing on delivery and relay egress.
- **Concurrency.** Affects compute fleets, which are peak-provisioned. Does not
  affect total egress.
- **ABR policy.** On-demand versus universal is roughly a $40k/month difference.
- **Cloudflare terms.** Dominates everything else if egress is not free.
- **R2 Class A operations.** Roughly $15k/month and driven by segment duration,
  not by bitrate or viewer count. 4-second segments halve it at the cost of about
  4 seconds of latency, which is a poor trade for a participatory product.

## Revision history

An earlier pass of this analysis produced approximately $52k/month and described
the work as "a hosting migration and a set of config fixes." Review identified
the following errors, all of which are corrected above.

- **ABR was discussed but not costed.** `-c:v copy` cannot generate renditions.
  The encoder fleet was missing from the bill entirely.
- **Fleet sizing was optimistic twice.** 250 sessions per box at 0.12 vCPU is 94
  percent of a 32-thread box, which is a saturation figure rather than a capacity
  figure, and SMT threads were treated as full vCPUs when a 16c/32t box delivers
  roughly 20 to 24 core-equivalents. Corrected sizing is nearer 100 to 120
  sessions per box.
- **The HLS uploader was called a header change.** It is a rewrite. The
  segment-before-playlist ordering defect was missed entirely on the first pass.
- **Bitrate basis was not re-based.** 3.2 Mbps is the current default but is thin
  for the 1080p60 quality target being discussed, and a diagram showing four
  platforms contradicted a stated three-destination assumption.
- **Peak was modelled at 3.2x average**, which is too thin. 4x to 5x is the
  planning figure, though the 10,000 theoretical maximum remains a ceiling rather
  than a sizing target.

Two points from that pass survive review and are retained: Hetzner traffic
metering above the 20 TB allowance was already costed at EUR 1/TB, and the claim
that `s-maxage` disables `stale-while-revalidate` at Cloudflare is unverified.
The operational conclusion holds regardless: cache behavior must be verified
under load, not assumed.

## See also

- `docs/media-cost-architecture.md` for what is implemented today and the rollout
  sequence.
- `docs/performance-baseline.md` for the per-session performance gates.
- `docs/rtmp-ingest.md` for the OBS ingest path.
