# DITCH — Business Model Canvas
### Startcup Lazio 2026

---

## 1. CUSTOMER SEGMENTS

**Primary — Mid-tier content creators**
Streamers with 1K–100K followers who are already present on multiple platforms (Twitch + YouTube, or TikTok + Kick) but forced to choose where to stream live. They feel the fragmentation pain daily. They're influential enough that their audience copies their behavior.

**Secondary — Active viewers / aspiring participants**
Viewers who want more than a chat window. The audience member who would pay to appear on their favorite creator's stream. DITCH gives them that without paying — which makes them loyal advocates.

**Tertiary — Brands in the creator economy**
Performance marketers who buy influencer sponsorships but struggle to prove cross-platform reach. DITCH Ads offers a single buy that reaches all platforms simultaneously. Target: DTC brands, gaming companies, lifestyle brands already spending on creator sponsorships.

---

## 2. VALUE PROPOSITIONS

**For creators:**
- Stream once, be everywhere — no more choosing between platforms or violating TOS
- Turn your passive audience into live on-screen participants, across all platforms at once
- Unified chat: one view of every message from every platform
- Full browser-based studio — no OBS, no hardware encoder required

**For viewers:**
- Go from watching to being on stream, visible to thousands across multiple platforms simultaneously
- The most direct way to be noticed by a creator and their whole audience

**For brands (DITCH Ads):**
- One creative buy reaches the creator's audience on YouTube, Twitch, TikTok, and Kick at the same time
- Cannot be skipped. Cannot be ad-blocked. Baked into the video stream.
- 3–4x effective reach vs. single-platform buy at a fraction of the cost per impression

---

## 3. CHANNELS

**Creator acquisition:**
- Direct: DITCH.com, organic SEO around "multi-stream" and "multi-platform streaming"
- Community: Discord servers, Reddit (r/Twitch, r/streaming, r/NewTubers), creator YouTube channels
- Product-led: the viewer-joins-stream moment is inherently shareable — clips go viral naturally
- Streamer agencies and talent management firms (B2B partnerships)

**Viewer acquisition:**
- Zero direct acquisition needed — viewers come through their favorite creator's stream
- DITCH is discovered by viewers on Twitch/YouTube/TikTok who see a participant appear on screen and ask "how do I do that?"

**Brand acquisition (DITCH Ads, Day 30+):**
- Direct outreach to DTC brand performance teams
- Creator agency partnerships (they already represent both sides)

---

## 4. CUSTOMER RELATIONSHIPS

**Creators — Self-service SaaS**
Sign up, connect platforms, go live. No sales touch required for onboarding. Creator support via documentation and community Discord.

**Viewers — Frictionless participation**
No subscription, no barrier. A viewer clicks a link, allows camera access, and is on stream in under 60 seconds. The relationship is built through the experience, not a product feature.

**Brands — Managed service (initially)**
DITCH Ads is a direct-sold product at launch. Brands book through an account manager. Transition to programmatic self-serve as inventory scales.

---

## 5. REVENUE STREAMS

**Stream 1 — Creator SaaS subscriptions**

| Tier | Price (est.) | Destinations | Concurrent Participants |
|------|-------------|--------------|------------------------|
| Starter | €15/mo | 2 platforms | 2 participants |
| Pro | €39/mo | 5 platforms | 6 participants |
| Studio | €99/mo | Unlimited | 12 participants |

Annual billing at ~20% discount. Primary revenue driver in Year 1.

**Stream 2 — DITCH Ads (CPM-based)**
Brands pay per 1,000 cross-platform impressions. Pricing premium: one DITCH impression = simultaneous reach on all connected platforms. Target CPM: €12–18 (vs. €3–6 single-platform). Revenue share with creators: 60/40 (creator/DITCH).

DITCH Ads is a Day 30+ product — requires meaningful creator network before ad inventory has value.

---

## 6. KEY RESOURCES

**Technology:**
- Canvas compositor (background-tab-safe video compositing engine — proprietary, browser-native)
- RTMP relay / fan-out infrastructure (WebSocket → ffmpeg → multi-destination RTMP)
- WebRTC participant pipeline (Agora-powered, creator + viewer real-time video)
- Realtime server (Socket.io — chat aggregation, participant signaling, session state)

**Infrastructure:**
- Vercel (frontend), Railway (API, relay, realtime), Supabase (database + auth)

**Brand:**
- DITCH as the creator's control center — the name signals rebellion against fragmentation

**Data (future moat):**
- Cross-platform engagement data: who watches on which platform, viewer-to-participant conversion rates, chat engagement by platform — no single platform has this view

---

## 7. KEY ACTIVITIES

**Core (now):**
- Platform engineering: compositor, relay, WebRTC, studio UX
- Creator onboarding: reducing time-to-first-live-stream
- Infrastructure reliability: relay uptime, stream latency, reconnect behavior

**Growth (Year 1):**
- Creator acquisition: partnerships, community presence, referral mechanics
- Platform API integrations (chat ingest, viewer counts from Twitch/YouTube APIs)

**Monetization (Year 1+):**
- DITCH Ads sales and operations: brand relationships, ad scheduling, creative delivery
- Analytics dashboard for creators and brands

---

## 8. KEY PARTNERSHIPS

**Infrastructure partners:**
- Vercel, Railway, Supabase, Agora — current vendors, relatively replaceable
- CDN providers as scale demands grow

**Platform integrations:**
- Twitch, YouTube, TikTok Developer APIs — for chat ingest and viewer data (where permitted)
- These are not commercial partnerships — they are API consumer relationships

**Distribution partners (target):**
- Streamer talent agencies (represent creators we want to acquire)
- Multi-Channel Networks (MCNs) — they manage large creator rosters
- Gaming organizations and esports orgs (high streaming frequency, multi-platform already)

**Brand partners (DITCH Ads, future):**
- DTC brand performance teams
- Creator-focused ad agencies

---

## 9. COST STRUCTURE

**Fixed costs:**
- Engineering salaries (primary cost driver)
- Infrastructure baseline: Supabase, Vercel, Railway hosting

**Variable costs (scale with usage):**
- Relay server compute: CPU-intensive per concurrent stream (ffmpeg processes)
- Agora WebRTC: per-minute billing per participant
- Bandwidth/CDN: scales with stream count and quality

**Go-to-market costs:**
- Creator community presence (low cash, high time)
- DITCH Ads sales team (Year 1+, commission-based initially)

**Cost advantages:**
- Browser-native studio eliminates hardware/software licensing costs for creators
- Product-led growth reduces paid acquisition costs — viral viewer-joins-stream mechanic is the primary growth engine

---

## CANVAS SUMMARY (one-line per block)

| Block | DITCH |
|-------|-------|
| Segments | Mid-tier creators, active viewers, brands |
| Value prop | Stream once everywhere + viewers become participants |
| Channels | Product-led viral + creator communities + agencies |
| Relationships | Self-serve SaaS for creators, frictionless for viewers |
| Revenue | Subscription (SaaS) + cross-platform ad CPM |
| Resources | Compositor tech, relay infra, WebRTC pipeline |
| Activities | Platform eng, creator onboarding, relay ops |
| Partnerships | Infra vendors, talent agencies, MCNs |
| Costs | Engineering + relay compute + Agora WebRTC |

---

*Document version: Startcup Lazio 2026 — 2026-05-08*
