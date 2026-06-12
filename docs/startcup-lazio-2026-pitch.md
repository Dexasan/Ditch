# DITCH — Startcup Lazio 2026
### Kickoff Meeting Pitch Script

> **Format:** 3–5 minute spoken pitch. Each section is a beat — you can cut or expand any one of them.
> **Language note:** Written in English. Switch to Italian for the full presentation if required by the committee.

---

## OPENING HOOK (30 sec)

> *"There are 50 million live streamers in the world. Every single one of them is being forced to make a choice: do I stream on Twitch, or YouTube, or TikTok? Because the platforms won't let you do all three at once — and even if you find a workaround, your audience is still scattered across five different chat windows, with no way to interact with each other or with you.*
>
> *And the viewers? They're stuck watching through a tiny chat box, typing into a void.*
>
> *We built DITCH to end both of those problems at the same time."*

---

## THE PROBLEM (45 sec)

Live streaming has two broken pieces that nobody has fixed together:

**1. Distribution is fragmented.**
Platforms like Twitch, YouTube, and TikTok actively restrict cross-streaming. A creator building an audience has to pick one, or fight the terms of service. Tools like Restream help with multi-streaming but only scratch the surface — they distribute the video, they don't fix the experience.

**2. Interaction is passive.**
The viewer-to-creator relationship in live streaming is still the same as television: one person on screen, thousands watching through a chat window. The "interaction" is a text message scrolling by at 200 messages per minute. Nobody sees it. It doesn't matter.

The result: creators are underreaching their audience, and viewers have no reason to be loyal to a specific platform.

---

## THE SOLUTION (60 sec)

**DITCH is a video-first live platform. Stream once, reach everywhere, bring your audience back to one place.**

Here's how it works:

1. **The creator goes live on DITCH.** DITCH is their studio — camera, microphone, scene layout, everything.

2. **DITCH fans out to every platform simultaneously.** Twitch, YouTube, TikTok, Kick — one stream, all destinations. Because DITCH is the origin, platform cross-streaming restrictions don't apply.

3. **Viewers on any platform can enter the creator's DITCH channel and appear live on stream.** Not in chat. On screen. Their camera feed slots into the live broadcast, and goes back out to every platform in real time.

That last part is the product. The moment a viewer from YouTube appears live alongside a creator — simultaneously visible to every Twitch viewer, every TikTok viewer, every YouTube viewer — that is something no other platform can do. It's a new kind of social interaction that happens in public, at scale, in real time.

---

## WHY IT'S DEFENSIBLE (30 sec)

DITCH's technical architecture is the moat. We control the composite stream origin. That means we can:

- Bypass platform cross-streaming restrictions (we're the origin, not a relay)
- Insert viewer feeds into the broadcast before it reaches any platform
- Aggregate chat from every platform into one unified view
- And — critically — bake ad content directly into the stream where it cannot be skipped or blocked

No platform can replicate this from inside their own ecosystem. YouTube can't put a Twitch viewer on screen. Twitch can't put a TikTok viewer on screen. DITCH can put both on screen, simultaneously, on both platforms.

---

## BUSINESS MODEL (45 sec)

**Revenue layer 1 — Platform (SaaS).**
Creators pay a monthly subscription for multi-stream distribution, unlimited participants, and the full studio experience. Pricing tiers by stream count and concurrent participants.

**Revenue layer 2 — DITCH Ads.**
The first live participatory ad network. A creator designates one participant slot as a sponsored slot. Every ~30 minutes, a brand's video plays in that slot — baked into the composite stream, cross-platform, unskippable, unblockable.

One ad buy reaches the creator's audience simultaneously on YouTube, Twitch, TikTok, and Kick. That's 3–4x the effective reach of a single-platform buy. Brands pay a premium CPM that's still cheaper per-impression than buying each platform separately.

We call it DITCH Ads — the irony is intentional. You're not ditching the ad. You're ditching the traditional ad format for something that feels human.

---

## TRACTION (30 sec)

We have a working product in production today.

- Full browser-based studio: camera, mic, scene switching, screen share
- Multi-stream relay live and tested (Twitch, YouTube)
- Participant flow end-to-end: viewer requests → creator approves → viewer appears live on stream
- Unified chat across all connected platforms
- Canvas compositor running in background tabs (the hard technical problem — solved)
- Deployed: frontend on Vercel, relay and API on Railway

We're not pitching an idea. We're pitching a live, working system.

---

## THE MARKET (30 sec)

- **Global live streaming market:** $1.5B in 2023, projected $6.8B by 2030 (CAGR ~24%)
- **Creator economy:** 50M+ creators globally, 2M+ who earn revenue from live content
- **Addressable entry point:** mid-tier streamers (1K–100K followers) who have audience on multiple platforms and are currently choosing distribution over experience

Our initial wedge is the multi-stream problem — the market already knows they need a solution. DITCH just solves a bigger problem than they thought they had.

---

## THE ASK (adapt as needed)

> *[Use this section if the committee expects a funding or support ask. Otherwise cut it.]*

We're here for Startcup Lazio because we believe the best place to build what comes after social media is in a room with people who understand what it takes to go from working product to category-defining company.

We're looking for:
- **Mentorship** from advisors with media, creator economy, or ad-tech experience
- **Network** into European broadcaster and creator partnerships
- **Visibility** to accelerate our go-to-market ahead of our creator beta launch

---

## CLOSING LINE (10 sec)

> *"Creators are tired of choosing which audience to ignore. Viewers are tired of watching through a chat window. We built the product that solves both — and it's live right now. That's DITCH."*

---

## Q&A PREP — Likely Questions

**"How is this different from Restream?"**
Restream distributes video. It doesn't touch the interaction layer. Viewers on Restream are still passive. DITCH makes viewers participants, live on screen across all platforms. Restream is infrastructure; DITCH is a new live format.

**"Can platforms ban you for bypassing their restrictions?"**
The restrictions are on creators streaming native content to competitors simultaneously. DITCH is the origin — we're an RTMP source, like an encoder. This is technically equivalent to a creator using OBS with a plugin. It's within TOS. DITCH Ads content is legally equivalent to a creator doing a sponsored segment (paid promotion disclosure required, already standard practice).

**"What's your go-to-market?"**
Mid-tier streamers (1K–100K followers) who already multiplatform post but not yet multiplatform live. They feel the fragmentation pain acutely. They're the easiest to convert and the most influential to their audiences. One creator with 50K followers on YouTube and 30K on Twitch becomes a walking DITCH demo.

**"Where's the team?"**
> *[Fill in your own answer here.]*

**"What's the biggest risk?"**
Platform policy changes. If Twitch or YouTube changes their encoder/source policies, our distribution model is affected. Our hedge: DITCH is also a native platform. As our own audience grows, external distribution matters less. We're building toward the day where DITCH itself is where you stream, not just where you originate.

---

*Document version: Startcup Lazio 2026 kickoff — 2026-05-08*
