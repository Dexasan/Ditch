# DITCH — Executive Summary
### Startcup Lazio 2026

---

## The Company

**DITCH** is a video-first live platform that solves two problems simultaneously: fragmented distribution and fragmented interaction in live streaming.

Creators go live once on DITCH. DITCH pushes that stream to every major platform — Twitch, YouTube, TikTok, Kick — at the same time. Viewers watching on any of those platforms can enter the creator's DITCH channel and appear live on screen, broadcast back to all connected platforms simultaneously.

The result is a new kind of live interaction: one moment, every audience, everyone watching together.

---

## The Problem

Live streaming is the fastest-growing format in the creator economy — a $1.5B market growing at ~24% annually. Yet two structural problems remain unsolved:

**Platform fragmentation forces a choice.**
Twitch, YouTube, and TikTok all restrict creators from streaming to competitors simultaneously. A creator building an audience must pick one platform and ignore the others. Multi-streaming tools (Restream, Castr) offer a partial workaround — they distribute video — but they don't change the interaction experience and they don't aggregate the audience.

**Viewers are still passive.**
The viewer-to-creator relationship in live streaming is unchanged from television: one person on screen, thousands watching through a chat window moving too fast to read. There is no mechanism for a viewer to become present — to matter — in real time.

These two problems compound each other: creators can't reach their full audience, and the audience can't do anything meaningful when they get there.

---

## The Solution

DITCH is a browser-based live studio with three capabilities in one product:

1. **Multi-stream gateway.** The creator streams from DITCH once. DITCH is the RTMP origin, pushing simultaneously to all connected platforms. Because DITCH is the source — not a relay sitting between the creator and the platform — cross-streaming restrictions don't apply.

2. **Participation engine.** Any viewer on any connected platform can click a link, grant camera access, and appear live on the creator's stream within 60 seconds — broadcast back to every platform at once. Not in chat. On screen.

3. **Unified interaction layer.** Chat messages from Twitch, YouTube, TikTok, and Kick are normalized and aggregated into a single view. The creator manages one conversation, not five.

The technical foundation — a proprietary canvas compositor that builds the composite video stream before it reaches any platform — is what makes all three capabilities possible and what makes DITCH defensible.

---

## Why Now

The market is ready for this product for three reasons:

- **Creator multi-platforming is accelerating.** The influencer marketing market grew 29% in 2024. Creators are being asked by brands to have presence everywhere, but the tools haven't caught up.
- **Platform fragmentation is getting worse.** TikTok's regulatory uncertainty, Twitch's shrinking market share, and YouTube's aggressive push into live are fracturing audiences faster than creators can manage.
- **Browser WebRTC is now mature enough.** The technical stack required to build a browser-native, background-safe compositor didn't exist at production quality two years ago. It does now.

---

## Business Model

**Revenue stream 1 — SaaS subscriptions (creators)**
Monthly and annual plans tiered by number of destination platforms and concurrent participants. Target: €15–99/month per creator. This is the primary revenue driver in Year 1.

**Revenue stream 2 — DITCH Ads (brands)**
The first live participatory ad network. A creator designates one participant slot as sponsored. DITCH Ads schedules brand video content into that slot programmatically — baked into the composite stream, simultaneously visible on all platforms, unskippable and unblockable.

One DITCH Ads impression reaches the creator's audience on YouTube, Twitch, TikTok, and Kick at the same time. Target CPM: €12–18, representing 3–4x the effective reach of a single-platform buy at a lower cost-per-impression. Revenue split: 60% creator / 40% DITCH.

DITCH Ads launches after the creator network reaches meaningful inventory scale (Day 30+).

---

## Traction

DITCH has a fully working product in production today:

- Browser-based studio: camera, microphone, scene switching, screen share
- Multi-stream relay: live and tested to Twitch and YouTube
- Participant flow: end-to-end (request → approve → on screen)
- Unified chat aggregation across connected platforms
- Canvas compositor: background-tab safe (the key technical problem — solved)
- Deployed infrastructure: Vercel (frontend), Railway (API, relay, realtime), Supabase (database + auth)

**Stream startup latency:** 4–6 seconds. **Compositor performance:** stable 30fps with tab backgrounded.

We are not pitching an idea. We are pitching a live, working system.

---

## Market Opportunity

| Metric | Figure |
|--------|--------|
| Global live streaming market (2023) | $1.49B |
| Projected market (2030) | $6.8B |
| CAGR | ~24% |
| Active content creators globally | 50M+ |
| Creators earning revenue from live | ~2M |
| Influencer marketing market (2024) | $24B |
| Creator tools market (2024) | $4.2B |

**Beachhead segment:** Mid-tier streamers (1K–100K followers) with multi-platform audiences and a felt distribution problem. Estimated 200K–500K globally. Conversion to paid at even 1% of this segment at €39/month = €1M+ ARR.

---

## Competitive Landscape

| Competitor | What they do | What they don't do |
|------------|-------------|-------------------|
| Restream | Multi-stream distribution | No interaction layer, no participant feature |
| StreamYard | Browser studio + multi-stream | No viewer participation, no cross-platform participant broadcast |
| Twitch/YouTube | Native live platform | Locked ecosystem, can't reach competitor audiences |
| OBS + plugins | Full local control | Complex setup, no participant feature, no browser-native |

**DITCH's defensible edge:** We control the composite stream origin. No platform can replicate cross-platform simultaneous participant broadcast from inside their own ecosystem. The architecture is the moat.

---

## Go-to-Market

**Phase 1 — Creator wedge (now)**
Acquire mid-tier creators through streaming communities (Reddit, Discord), creator YouTube, and direct partnerships with talent management agencies. The entry hook is the multi-stream problem — they already know they need a solution. DITCH delivers that, plus the interaction layer they didn't know existed yet.

**Phase 2 — Viral participant loop (Month 3+)**
Every viewer who appears on stream is a walking advertisement. They clip it, post it, and their friends ask how to do it. Viewer acquisition is product-led — DITCH acquires audience through the creator's existing reach.

**Phase 3 — DITCH Ads (Month 6+)**
Once creator inventory reaches scale, activate DITCH Ads. Initial brand sales are direct-sold by a small team. Transition to programmatic as the network grows.

---

## The Team

> *[Add founder and team bios here. Include relevant background in streaming, WebRTC, ad tech, or creator economy.]*

---

## The Ask

DITCH is participating in Startcup Lazio 2026 to access:

- **Mentorship** from advisors with experience in media tech, creator platforms, or ad networks
- **Network** into European broadcaster relationships, creator agencies, and enterprise brand partnerships
- **Visibility** to support creator beta launch and early brand conversations

---

## One Line

> *Creators are tired of choosing which audience to ignore. Viewers are tired of watching through a chat window. DITCH solves both — and it's live right now.*

---

*Document version: Startcup Lazio 2026 — 2026-05-08*
*Contact: [founder email / LinkedIn]*
