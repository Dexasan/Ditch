# DITCH — Business Plan
### Startcup Lazio 2026

---

## 1. EXECUTIVE OVERVIEW

DITCH is a video-first live platform that eliminates the two core problems in live streaming: fragmented distribution and passive audiences.

Creators go live once on DITCH. DITCH distributes the stream simultaneously to Twitch, YouTube, TikTok, Kick, and other platforms. Viewers watching on any connected platform can enter the creator's DITCH channel and appear live on stream — broadcast back to every platform at once. DITCH is also the first "live participatory ad network" (DITCH Ads): brands sponsor participant slots, reaching a creator's cross-platform audience simultaneously in a single buy.

**Mission:** Make every live stream participatory — and make distribution a solved problem, not a daily choice.

**Stage:** Working product in production. Pre-revenue. Seeking creator beta users and program support.

---

## 2. PROBLEM ANALYSIS

### 2.1 Platform Fragmentation

The major live streaming platforms — Twitch, YouTube, TikTok, Kick — have conflicting commercial interests and enforce terms of service that restrict or discourage simultaneous cross-platform streaming. A creator is forced to choose:

- Stream only on Twitch: lose YouTube and TikTok audiences
- Stream on YouTube: violate Twitch exclusivity if under contract, lose TikTok native reach
- Stream manually across platforms: impossible without hardware encoders, technical complexity, and a second device just to manage

Third-party tools (Restream, Castr, StreamYard) offer multi-stream distribution but position themselves as passive relay infrastructure. They distribute pixels. They do not aggregate audiences, do not provide participation mechanics, and do not change the viewer's relationship to the stream.

**Consequence for creators:** Smaller effective audience per stream than they have in total across platforms. Engagement fragmented. Monetization potential limited.

### 2.2 Passive Audiences

In every major live streaming platform, the viewer experience is fundamentally unchanged from broadcast television: one person on screen, thousands watching through a chat feed that moves too fast to read. The creator cannot engage meaningfully with individual viewers. The viewer has no mechanism to be present — to matter — in real time.

This passivity is a design failure, not a preference. When given the option to appear on stream, a significant proportion of viewers choose it. The desire to be seen is a fundamental human drive. No platform has built a scalable mechanism for it.

**Consequence for viewers:** No loyalty-building loop. Viewers drift between platforms based on content, not relationship. Creator retention suffers.

### 2.3 Advertising Fragmentation

Brands buying creator sponsorships face the same problem from the other side: they must negotiate separately with each platform's ad system or buy individual creator sponsorships on a per-platform basis. A brand reaching a creator's 50K YouTube audience does not simultaneously reach their 30K Twitch audience. There is no unified buy that reaches both at once.

Performance marketers are aware of this gap but have no product to address it. The creator economy is a $24B market. The ad inefficiency inside it is structural.

---

## 3. SOLUTION

### 3.1 Product Architecture

DITCH is built on a proprietary canvas compositor that constructs the composite video stream inside the browser before distribution. This is the technical foundation that makes every DITCH capability possible:

**Layer 1 — Studio**
A full browser-based live studio. Creator camera, microphone, scene configuration, screenshare, and layout management. No download, no hardware encoder required. Background-tab safe (compositor runs via Web Worker + Breakout Box API — the frame is produced even when the tab is not in focus).

**Layer 2 — Multi-stream relay**
The compositor output is streamed via WebSocket to DITCH's server-side relay. The relay runs ffmpeg processes that fan the stream out to every connected destination platform via RTMP. Because DITCH is the RTMP origin (not a re-encoder sitting between creator and platform), cross-streaming TOS restrictions do not apply.

**Layer 3 — Participation engine**
Any viewer on any connected platform can click a DITCH participation link, grant camera access, and be routed into the creator's session via WebRTC (Agora). The compositor receives the participant's video feed and inserts it into the composite frame. The participant is now baked into the stream going out to every platform simultaneously.

**Layer 4 — Unified interaction**
Chat messages from all connected platforms are ingested, normalized, and aggregated in real time via the DITCH realtime server (Socket.io). The creator sees one unified chat view. Participant requests, approvals, and removals are managed from the same control room.

### 3.2 Key Technical Achievements

| Problem | Solution | Status |
|---------|----------|--------|
| Background-tab compositor | Web Worker + Breakout Box API | Solved, in production |
| Sub-10s stream startup | Parallel auth + forced H264 keyframes | 4–6s, achieved |
| Auto-reconnect on relay failure | 5-attempt exponential backoff in relay client | Implemented |
| Cross-platform chat aggregation | Normalized `ChatMessage` type, Socket.io room per channel | Implemented |
| Secure RTMP credentials | Never returned to browser; relay-side only | Implemented |

---

## 4. MARKET ANALYSIS

### 4.1 Market Size

| Segment | 2023 Value | 2030 Projection | CAGR |
|---------|-----------|-----------------|------|
| Global live streaming | $1.49B | $6.77B | 24.1% |
| Creator economy tools | $4.2B | ~$9B (est.) | ~11% |
| Influencer marketing | $21.1B | ~$48B (est.) | ~13% |
| Live streaming ads | $4.8B | ~$12B (est.) | ~14% |

Sources: Statista, Grand View Research, Influencer Marketing Hub 2024 Report.

### 4.2 Target Segments

**Beachhead — Mid-tier multi-platform creators (Year 1)**
- Definition: 1K–100K followers, active on 2+ platforms, streaming at least weekly
- Problem awareness: high — they feel the distribution pain actively
- Estimated global population: 200K–500K
- Acquisition approach: streaming communities, creator YouTube, talent agency partnerships
- Revenue potential: 1% conversion at €39/mo avg = €936K–€2.34M ARR

**Expansion — Large creators and streaming organizations (Year 2)**
- Definition: 100K+ followers, often under management agency or org
- Problem awareness: very high — they have infrastructure to manage but still face fragmentation
- Higher willingness to pay — Studio tier (€99/mo+) or enterprise contracts
- Acquisition approach: direct agency partnerships, esports org BD

**Brand advertisers — DITCH Ads (Year 2+)**
- Definition: DTC brands and gaming companies already spending on creator sponsorships
- Value proposition: cross-platform simultaneous reach, single buy
- Acquisition approach: direct sales, creator agency introductions
- Revenue potential: at 1,000 active streams × 2 ad breaks/hr × €15 CPM × 1,000 viewers = significant unit economics at scale

### 4.3 Competitive Analysis

| Platform | Distribution | Participation | Cross-platform participants | Ad network |
|----------|-------------|--------------|----------------------------|------------|
| **DITCH** | ✅ Multi | ✅ Any viewer | ✅ Yes | ✅ (planned) |
| Restream | ✅ Multi | ❌ | ❌ | ❌ |
| StreamYard | ✅ Multi | ✅ Guests only | ❌ | ❌ |
| Twitch | ❌ Single | ❌ | ❌ | ✅ Single-platform |
| YouTube Live | ❌ Single | ❌ | ❌ | ✅ Single-platform |
| OBS + plugins | ✅ With plugins | ❌ | ❌ | ❌ |

**DITCH is the only product that combines multi-stream distribution with cross-platform viewer participation.** That intersection is the market position.

---

## 5. BUSINESS MODEL

### 5.1 Revenue Stream 1 — Creator SaaS

Monthly and annual subscriptions. Pricing structured by platform destinations and concurrent participants.

| Tier | Monthly | Annual (−20%) | Destinations | Participants |
|------|---------|---------------|-------------|-------------|
| Starter | €15 | €144 | 2 | 2 |
| Pro | €39 | €374 | 5 | 6 |
| Studio | €99 | €950 | Unlimited | 12 |
| Enterprise | Custom | Custom | Unlimited | Custom |

Annual billing is the primary target — reduces churn and smooths cash flow.

**Unit economics (Pro tier):**
- MRR per creator: €39
- Gross margin target: ~70% (infrastructure cost ~€12/creator/month at moderate stream frequency)
- Payback period on CAC: target < 6 months

### 5.2 Revenue Stream 2 — DITCH Ads

The live participatory ad network. Requires creator network at scale before activation.

**Mechanics:**
- Creator designates one participant slot as "DITCH Ads slot"
- DITCH Ads schedules brand video creative (30–60 seconds) programmatically into that slot every ~30 minutes
- Ad is baked into the composite stream — visible on all connected platforms, unskippable, unblockable
- From each platform's perspective: standard participant video (legally equivalent to a creator sponsored segment with disclosure)

**Pricing model:**
- CPM-based (cost per 1,000 cross-platform impressions)
- Target CPM: €12–18 (premium vs. single-platform, justified by simultaneous multi-platform reach)
- Revenue share: 60% creator / 40% DITCH

**Why the premium is justified:**
A creator with 20K viewers on Twitch + 15K on YouTube + 10K on TikTok = 45K simultaneous cross-platform viewers. A brand buying DITCH Ads reaches all 45K in one placement. Buying each platform separately at standard CPMs would cost ~3x more and reach each audience at different times.

**Timeline:** Launch DITCH Ads when creator network reaches ~500 active monthly streams. This is a Day 30+ initiative.

### 5.3 Financial Model (3-Year Projection)

> *Note: projections based on conservative creator adoption curve and market benchmarks. To be refined with actual user data.*

**Year 1 — Creator foundation**

| Metric | Q1 | Q2 | Q3 | Q4 |
|--------|----|----|----|----|
| Active paying creators | 50 | 150 | 350 | 700 |
| Avg MRR per creator | €35 | €36 | €37 | €38 |
| MRR | €1,750 | €5,400 | €12,950 | €26,600 |
| ARR run rate (Q4) | — | — | — | €319,200 |

**Year 2 — Growth + DITCH Ads launch**

| Metric | Target |
|--------|--------|
| Active paying creators | 3,000 |
| Avg MRR per creator | €42 |
| Creator SaaS ARR | €1.51M |
| DITCH Ads revenue | €300K–500K (early network) |
| Total ARR | ~€1.8–2.0M |

**Year 3 — Scale**

| Metric | Target |
|--------|--------|
| Active paying creators | 10,000 |
| Creator SaaS ARR | €5.0M |
| DITCH Ads revenue | €2.0–3.0M |
| Total ARR | €7.0–8.0M |

### 5.4 Cost Structure

**Infrastructure costs (variable, scale with streams):**
- Relay server compute (ffmpeg, per concurrent stream): ~€0.08–0.15/stream-hour
- Agora WebRTC (participant video): ~€0.0099/minute per user
- Supabase, Vercel, Railway (platform): ~€300–500/month baseline

**People costs (primary fixed cost):**
- Engineering: platform, reliability, new features
- Eventual: creator success, ad sales, marketing

**CAC assumptions:**
- Community-driven (low cash cost): €10–30 per creator via organic/community channels
- Agency partnerships: higher upfront, lower CAC at scale due to bulk onboarding
- Target blended CAC: < €150 per paying creator

---

## 6. GO-TO-MARKET STRATEGY

### 6.1 Phase 1 — Creator Wedge (Months 1–6)

**Goal:** 500 active creators, 150+ paying.

**Channels:**
- Streaming communities: Reddit (r/Twitch, r/NewTubers, r/streaming), Discord servers for streamers
- Creator YouTube: SEO and content around "how to stream to multiple platforms," "multi-stream setup"
- Direct outreach: mid-tier streamers with cross-platform audiences, identified via social listening
- Referral mechanics: creators who invite other creators get extended free trial or free tier upgrade

**Activation hook:**
Every creator who signs up and goes live gets a shareable participation link. The moment their first viewer joins as a participant, that creator becomes an active evangelist. The first live session is the product demo.

### 6.2 Phase 2 — Participant Viral Loop (Months 3–9)

**Goal:** Viewer-to-DITCH discovery becomes self-sustaining.

Each viewer who appears on a creator's stream:
- Has an on-screen moment broadcast to thousands of viewers on multiple platforms
- Naturally clips and shares the moment
- Their followers ask "how did you get on stream?" → find DITCH → find a creator → watch → join

This loop is baked into the product. No paid acquisition required for viewer growth. Viewer growth drives creator value, which drives creator acquisition.

### 6.3 Phase 3 — Creator Organization Partnerships (Months 6–18)

**Goal:** Bulk creator acquisition, higher LTV.

Target: esports organizations, gaming MCNs (Multi-Channel Networks), and talent management agencies that manage rosters of 10–200 streamers. A single partnership agreement can onboard 50+ creators in one deal.

Value proposition to agencies: DITCH gives their creators a distribution edge over unmanaged competitors. The agency can offer DITCH as a tool differentiator when signing new talent.

### 6.4 Phase 4 — DITCH Ads Launch (Month 12+)

**Goal:** First brand revenue, €100K ARR from ads.

Initial sales: direct-sold by founder/early team to 5–10 brands already active in creator sponsorships (DTC, gaming peripherals, lifestyle). Use existing creator partnerships to broker introductions.

Proof-of-concept metrics: CPM vs. single-platform equivalents, viewer dwell time in slot, cross-platform impression verification.

---

## 7. OPERATIONS

### 7.1 Current Infrastructure

| Component | Technology | Host | Status |
|-----------|-----------|------|--------|
| Frontend | Next.js 14 (App Router) | Vercel | Live |
| API server | Fastify (Node.js) | Railway | Live |
| Realtime server | Socket.io (Node.js) | Railway | Live |
| Relay (RTMP fan-out) | Node.js + ffmpeg | Railway | Live |
| Database + Auth | Supabase (Postgres + Auth) | Supabase | Live |
| WebRTC (participants) | Agora SDK | Agora cloud | Live |

### 7.2 Reliability and Scalability

**Current state:**
- Single relay process per stream (ffmpeg per destination)
- Auto-reconnect on relay failure (5 attempts, 2s delay)
- Stream startup: 4–6 seconds

**Scaling plan:**
- Horizontal relay scaling: Railway auto-scaling or migration to dedicated compute (AWS/GCP) at >100 concurrent streams
- Compositor offload: move canvas compositing to server-side for creators on low-end hardware (medium-term)
- CDN layer: add edge caching for static assets and reduce relay latency for non-EU creators (long-term)

**Key reliability metric:** relay uptime. A stream drop is the worst user experience for a creator. Target: 99.5% uptime during live sessions. Monitoring and alerting infrastructure is the immediate post-beta priority.

### 7.3 Compliance and Legal

**RTMP/TOS compliance:**
DITCH operates as an RTMP encoder — the same technical category as OBS, Streamlabs, and hardware encoders. This is within the TOS of all major platforms. DITCH does not claim any affiliation with or official partnership with Twitch, YouTube, TikTok, or Kick.

**DITCH Ads disclosure:**
All DITCH Ads content includes standard paid promotion disclosure compliant with FTC guidelines (US) and relevant EU advertising regulations. Legally equivalent to a creator conducting a sponsored segment, which is permitted on all major platforms.

**Data protection:**
Viewer camera feeds are transmitted via encrypted WebRTC (DTLS-SRTP). Stream keys and RTMP credentials are stored server-side only and never returned to the browser. Supabase RLS policies enforce row-level data isolation between users. GDPR-compliant data handling for EU users.

---

## 8. TEAM

> *[Complete this section with actual founder and team bios. Key experience to highlight: streaming/media tech, WebRTC/real-time systems, creator economy, ad tech, B2B SaaS sales.]*

**Founder — [Name]**
[Background, relevant experience, why uniquely positioned to build DITCH]

**Advisors (target):**
- Media tech / broadcaster executive
- Creator economy operator (agency or MCN background)
- Ad network / programmatic advertising specialist

---

## 9. RISK ANALYSIS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Platform TOS change restricting RTMP encoders | Low | High | DITCH is also a native platform — as DITCH audience grows, external distribution matters less. Build the native platform in parallel. |
| Agora WebRTC pricing at scale | Medium | Medium | Architecture allows swap to alternative WebRTC providers (Livekit, Daily.co) or self-hosted. |
| Creator acquisition slower than model | Medium | Medium | Reduce dependency on paid tiers — freemium model with feature-limited free tier to drive distribution virality. |
| Large platform builds equivalent feature | Low (2–3yr horizon) | High | Speed and specialization — DITCH is 100% focused on this; platform teams are not. First-mover creator loyalty is the hedge. |
| Relay infrastructure costs outpace revenue | Medium | Medium | Pricing model accounts for infrastructure cost at Pro tier. Starter tier may operate near-breakeven; Pro and Studio have healthy margins. |

---

## 10. MILESTONES

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| Creator beta launch | Month 1–2 | 50 creators onboarded, live sessions running |
| 150 paying creators | Month 3–4 | Revenue covers infrastructure costs |
| 500 paying creators | Month 6 | €18K+ MRR, product-market fit signal |
| DITCH Ads pilot | Month 9–12 | 3–5 brand partners, first ad revenue |
| 3,000 paying creators | Month 18 | €1.5M ARR run rate |
| Series A readiness | Month 18–24 | €2M+ ARR, positive unit economics, DITCH Ads growing |

---

## 11. THE ASK

DITCH is participating in Startcup Lazio 2026 for three categories of support:

**Mentorship**
Advisors with domain experience in: media technology, creator platforms, live ad networks, or B2B SaaS growth. The business model is clear; execution risk is the challenge. Experienced mentors reduce that risk.

**Network**
- European creator agencies and MCNs for bulk creator acquisition
- Broadcaster / media company partnerships (live streaming is converging with traditional broadcast)
- Brand performance marketing relationships for DITCH Ads early pilots

**Visibility and credibility**
Startcup Lazio affiliation adds credibility in European media and investor circles. We plan a creator beta launch within 60 days — program support accelerates distribution of that launch.

---

## 12. APPENDIX

### A. Technology Stack Detail

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 App Router | Channel pages, creator dashboard, viewer experience |
| API | Fastify (Node.js) | Auth, sessions, destinations, participants |
| Realtime | Socket.io (Node.js) | Chat aggregation, participant signaling, stream state |
| Relay | Node.js + ffmpeg | WebSocket → RTMP fan-out to destinations |
| Database | Supabase Postgres | All persistent data, RLS-enforced |
| Auth | Supabase Auth | JWT issuance, session refresh, email verification |
| WebRTC | Agora SDK | Creator + participant real-time video |
| Compositor | Canvas API + Web Worker | Background-safe composite frame production |
| Monorepo | pnpm workspaces + Turborepo | Shared types, coordinated builds |

### B. Key Domain Definitions

- **Channel:** A creator's permanent live home on DITCH. Always present; sessions come and go.
- **LiveSession:** One broadcast event — starts live, ends when the creator stops.
- **StreamDestination:** An external platform receiving the RTMP stream.
- **Participant:** A viewer who has moved from watching to on-screen. Flow: `waiting → approved → live → removed`.
- **ChatMessage:** A normalized message from any platform, aggregated in real time.

---

*Document version: Startcup Lazio 2026 — 2026-05-08*
*Prepared by: [Founder name] | Contact: [email]*
