# DITCH Community Revamp

Status: product and technical blueprint
Scope: public channel community, viewer home and discovery, creator community inbox, live-to-offline loops, moderation, notifications, and measurement
Audit date: 2026-08-09

## Executive diagnosis

The current feature is a post list, not a community system.

Production currently shows a live channel whose Community tab contains four filters, a sign-in prompt, and the empty state “No posts yet. Be the first.” The implementation supports only:

- three labels: moment, discussion, suggestion;
- a title and optional 500-character body;
- one upvote toggle;
- a pinned flag that has no creator-facing control in the web UI;
- a single channel-local feed, capped at 50 posts and sorted pinned-first, then all-time votes.

The surrounding product does not provide the loops that make posting worthwhile. There are no comments or creator replies, follows, memberships, notifications, activity feed, post detail pages, working “following” feed, profiles, online presence, reputation, moderation queue, content lifecycle, or realtime community events. Explore only lists channels that are live. Home is a broadcast launcher. Community activity is invisible everywhere except one tab and a five-item suggestion widget.

That creates a predictable dead-state loop:

1. A viewer finds no content and no familiar people.
2. Creating the first post carries social risk and promises no response.
3. The creator receives no actionable inbox or response workflow.
4. The viewer is not notified if anything happens.
5. Nothing from the live show becomes durable community content automatically.
6. The next visitor sees the same empty or stale feed.

The redesign must solve the loop, not merely restyle the cards.

## Product thesis

DITCH should not build a generic mini-Reddit. Its defensible community product is a persistent participation layer around a live show:

> Before the stream, the community shapes the show. During the stream, it participates in the show. After the stream, it turns the show into moments, decisions, and the next episode.

The core object is therefore not “a post.” It is a contribution to a show lifecycle.

## Target loops

### 1. Shape the next show

Viewer proposes an idea or question -> community supports it -> creator marks it Shortlisted -> it appears in the studio rundown -> creator uses it live -> the item becomes Featured on stream -> contributors receive recognition and notifications.

### 2. Turn live energy into durable content

Viewer marks a timestamp or the creator presses Save moment -> a draft moment is created with session context -> creator/mod confirms it -> the moment becomes a playable card -> discussion continues after the stream -> the best moment is shareable outside DITCH.

### 3. Bring people back

Viewer joins a channel -> chooses notification level -> receives only high-value events: creator reply, idea status change, featured-on-stream, upcoming show, live now -> returns to the exact item or show.

### 4. Grow belonging

Helpful participation -> acknowledgements and on-stream credit -> lightweight roles and contribution history -> trusted regulars become hosts/moderators -> newcomers see an active social surface with recognizable people.

## Information architecture

### Global navigation

- Home: personalized activity from joined channels, not a broadcast-only launcher.
- Live: current live rooms, ranked by relationship and participation opportunity.
- Discover: channels, moments, topics, and rising contributions; works when nobody is live.
- Inbox: replies, mentions, idea status changes, invites, moderation decisions, and live alerts.
- Studio: creator production tools.
- Profile menu: public identity, joined channels, contributions, notification settings.

### Channel navigation

- Overview: live player when live; otherwise next show, latest moment, creator update, and top open idea.
- Live: player, unified chat, queue, and on-screen actions.
- Board: structured contributions with views for For you, New, Top, and Resolved.
- Moments: playable session-linked highlights and timestamp submissions.
- About: description, schedule, rules, moderators, links, and members.

The existing Live | Community binary should be replaced. It hides the community whenever live is the default and collapses unlike content into one undifferentiated list.

## Content model

Keep three user-facing contribution modes, but make each behaviorally distinct.

### Ideas

Use for show suggestions, questions, challenges, guests, topics, and format proposals.

- fields: title, description, optional show/session target, topic tags;
- actions: support, comment, follow, creator response;
- lifecycle: Open -> Shortlisted -> Planned -> Used on stream -> Completed, or Declined;
- creator controls: merge duplicates, request clarification, add to rundown, schedule, feature;
- ranking: recent support velocity, commenter diversity, relationship quality, freshness, and creator state;
- payoff: status history and on-stream attribution.

### Conversations

Use for open-ended discussion and community updates.

- fields: title, body, attachments, tags;
- actions: react, reply, mention, follow, report;
- supports threaded replies to one level, then chronological conversation;
- creator and moderator answers can be highlighted without dominating ranking;
- can be locked, archived, pinned, or converted into an Idea.

### Moments

Use for clips and timestamped memories from real sessions.

- fields: session, start time, end time or timestamp, caption, thumbnail, source, approval state;
- actions: play, react, comment, share, remix/quote into a Conversation;
- lifecycle: Draft -> Processing -> Published, or Rejected;
- show verified session title/date and the contributor who found it;
- never accept an arbitrary media URL as the main creation path.

### Creator updates

Add a fourth creator-only content mode for schedule changes, recaps, polls, and announcements. This prevents moderators from misusing pinned discussions and gives followers a high-signal notification category.

## Screen specifications

### Channel overview

Above the fold:

- creator identity: avatar, banner or strong visual identity, name, short description;
- Join button with member count and notification options;
- live state or next scheduled show with timezone-aware countdown;
- one primary action based on state: Watch live, Remind me, or Join the channel;
- community pulse: “32 active this week,” three visible regulars, and a concise rules link.

Main modules:

- Live now or Next show;
- Top idea for the next show, with status and Support action;
- Latest moment with playable thumbnail;
- Creator update or recap;
- Active conversation;
- new-member prompt that asks a low-risk, specific question instead of “make the first post.”

### Board feed

Desktop layout:

- left/main: composer and ranked feed;
- right: next show, board stages, rules, top contributors, and moderator list;
- sticky channel nav; no nested application chrome.

Card anatomy:

- avatar, identity, role, and relative time;
- content type plus status, not color alone;
- complete enough body to judge relevance;
- session/show context when present;
- comment count and visible reply signal;
- primary action aligned to type: Support, React, or Play;
- creator response or status transition displayed inline;
- overflow menu for follow, copy link, report, edit, and delete where permitted.

Feed modes:

- For you: relationship-aware and freshness-aware;
- New: strict reverse chronology;
- Top: 24 hours, 7 days, 30 days, all time;
- Resolved: completed, used, or declined Ideas and archived Conversations.

### Post detail

Every contribution needs a durable URL and full context:

- original content and status history;
- creator answer;
- replies with reply composer;
- followers and participants;
- related/duplicate Ideas;
- linked Moment or show segment after it is used;
- previous/next item navigation on creator moderation workflows.

### Composer

Replace the three-button mini form with a guided modal or page.

- Ask what the viewer wants to do: Suggest something, Start a conversation, or Mark a moment.
- Explain the expected payoff in one sentence.
- Use per-type fields and validation.
- Detect likely duplicates before submission.
- Show channel rules inline.
- Allow drafts and attachment previews.
- After submission, show what happens next and offer Follow updates.

### Personalized home

Home should serve viewers and creators without forcing a mode choice.

- Continue: live rooms and moments recently viewed;
- From your channels: creator updates, replies, and idea state changes;
- Participate now: unanswered prompts, rising Ideas, rooms seeking guests;
- Upcoming: scheduled shows with reminders;
- Creator panel: compact studio readiness and community inbox, shown only to channel owners.

### Discover

Explore must not go empty when nobody is live.

- Live now;
- Active communities;
- Rising moments;
- Ideas gaining support;
- New channels with a seeded welcome prompt;
- topic filters and text search;
- cold-start ranking that mixes quality, freshness, and diversity instead of array order.

### Creator community inbox

Replace the dashboard's top-five suggestions widget with an operating queue.

- Needs reply;
- Rising Ideas;
- Ready to schedule;
- Moment drafts awaiting approval;
- Reports and moderation;
- Recently resolved;
- bulk actions for status, tags, merge, lock, and assignment;
- response templates kept optional and editable;
- “Add to show” pushes the Idea into the studio rundown.

### Studio integration

- Rundown panel shows scheduled Ideas and questions.
- Creator can display a contribution as an on-stream overlay.
- “Used on stream” creates a status event and attribution.
- Save-moment action captures session/timestamp context.
- Participant queue shows member history, prior on-screen appearances, and moderation notes visible only to authorized staff.
- At stream end, creator sees a generated recap draft: used Ideas, marked Moments, active contributors, and follow-up prompts.

### Inbox and notifications

Notification categories:

- direct: replies, mentions, moderator actions;
- contribution: support milestones, status transitions, featured/used on stream;
- channel: creator updates, scheduled show, live now;
- moderation: assigned reports and appeals.

Delivery rules:

- in-app inbox first;
- email/push opt-in by category and per-channel level;
- bundle low-value activity;
- never notify for every reaction;
- deep-link to the exact reply, contribution, or live state.

## Identity and belonging

- public user profiles with avatar, display name, short bio, joined channels (privacy-controlled), contribution history, and on-stream appearances;
- channel membership with joined_at, notification level, role, and last_seen_at;
- roles: owner, host, moderator, regular, member; roles confer capabilities, not vanity status alone;
- creator acknowledgements: Helpful, Featured, Used on stream;
- contribution stats should emphasize impact, not raw posting volume;
- viewer identity created during onboarding, not deferred until after first contribution.

Avoid launching gamified points, streak pressure, public downvotes, or an open follower graph in the first revamp. They optimize volume before the platform can control quality.

## Moderation and trust

Minimum safe launch:

- channel rules accepted before first contribution;
- report reasons and block/mute controls;
- creator/mod roles and scoped permissions;
- post/reply edit history and soft deletion;
- lock, archive, pin, remove, restore, and ban actions;
- link and media validation;
- per-user and per-channel rate limits;
- spam heuristics and duplicate detection;
- moderation audit log;
- notification suppression for blocked relationships;
- appeals state for removals/bans;
- privacy-safe analytics and retention rules for deleted content.

## Data model

Evolve rather than delete the existing tables.

### Core tables

- `channel_memberships`: channel_id, user_id, role, notification_level, joined_at, last_seen_at, banned_at;
- `community_posts`: retain ids/FKs; add slug, status, visibility, reply_count, reaction_count, follower_count, published_at, updated_at, deleted_at, locked_at, creator_response, created_by_role;
- `community_comments`: post_id, author_id, parent_id, body, status, created_at, updated_at, deleted_at;
- `community_reactions`: subject_type, subject_id, user_id, reaction, created_at;
- `community_post_follows`: post_id, user_id, created_at;
- `community_post_events`: post_id, actor_id, event_type, from_state, to_state, metadata, created_at;
- `community_tags` and `community_post_tags`;
- `community_moments`: post_id, session_id, start_ms, end_ms, asset_id, thumbnail_url, processing_status, verification_state;
- `scheduled_shows`: channel_id, session_id, title, starts_at, status, reminder settings;
- `show_rundown_items`: show/session id, post_id, position, state, used_at;
- `notifications`: recipient_id, actor_id, type, subject_type/id, channel_id, read_at, bundled_count, created_at;
- `moderation_reports`, `moderation_actions`, `channel_bans`;
- `user_blocks`;
- `community_activity_events`: append-only product analytics events, distinct from user notifications.

### Important constraints

- unique membership per channel/user;
- unique reaction per subject/user/reaction;
- unique follow per post/user;
- parent comments must belong to the same post;
- moments must reference a session owned by the same channel;
- explicit state transition validation for Ideas and Moments;
- counters maintained transactionally or through durable jobs, not by selecting all voters/comments into every feed response;
- RLS for every table, plus service-role API authorization checks;
- cursor indexes on `(channel_id, published_at desc, id desc)` and ranking/state-specific partial indexes.

## API design

Use cursor pagination and separate detail from feed payloads.

### Viewer and channel

- `GET /me/home`
- `GET /me/inbox?cursor=`
- `POST /me/inbox/read`
- `GET /discover?surface=&cursor=`
- `GET /channels/:slug/overview`
- `POST|DELETE /channels/:slug/membership`
- `PATCH /channels/:slug/membership`
- `GET /channels/:slug/feed?kind=&sort=&window=&cursor=`
- `POST /channels/:slug/posts`
- `GET|PATCH|DELETE /community/posts/:id`
- `POST /community/posts/:id/reactions`
- `POST|DELETE /community/posts/:id/follow`
- `GET|POST /community/posts/:id/comments`
- `PATCH|DELETE /community/comments/:id`
- `POST /community/subjects/:type/:id/report`

### Creator and moderator

- `GET /channels/:slug/community/inbox?queue=&cursor=`
- `POST /community/posts/:id/transition`
- `POST /community/posts/:id/creator-response`
- `POST /community/posts/:id/merge`
- `POST /community/posts/:id/moderation`
- `POST /sessions/:id/rundown`
- `POST /sessions/:id/moments`
- `GET /channels/:slug/moderation/reports`
- `POST /channels/:slug/moderation/actions`

### API corrections to current implementation

- validate `type` against the enum and reject invalid query values;
- validate all POST bodies with Fastify schemas;
- add ownership checks for session/media associations;
- stop swallowing all frontend fetch errors as an empty community;
- replace offsetless `.limit(50)` with cursor pagination;
- remove in-memory sorting and vote-array fanout from feed reads;
- return counter aggregates and caller state without exposing raw ballots;
- make vote/reaction writes idempotent with explicit PUT/DELETE semantics rather than a toggle endpoint;
- add rate limits, authorization tests, and transactional counter updates.

## Realtime design

Add authenticated rooms for user and channel scopes.

- `community:post_created`
- `community:post_updated`
- `community:post_removed`
- `community:comment_created`
- `community:reaction_summary`
- `community:status_changed`
- `community:creator_responded`
- `community:moment_ready`
- `notification:new`
- `channel:presence_summary`

Use realtime to update visible state, not as the source of truth. Clients refetch the affected entity after reconnect. Debounce reaction summaries. Do not broadcast private moderation state to channel rooms.

## Ranking and cold start

### Initial ranking

Start with transparent heuristics, not machine learning:

`score = recency_decay * (support_velocity + unique_commenters + creator_signal + relationship_signal + content_quality) - safety_penalties`

- creator status transitions and replies are stronger than pins;
- unique contributors matter more than raw reaction count;
- apply decay so old all-time winners do not freeze the feed;
- cap repeated exposure from one author;
- reserve slots for New and for unanswered prompts;
- log ranking reasons for tuning and moderation.

### Empty-channel seeding

Every new channel receives creator-editable starters:

- “What should we do on the next stream?”
- “Introduce yourself and say where you found the channel.”
- “What moment from the last show should become a clip?”

These are prompts, not fake user posts. The creator onboarding checklist requires a welcome note, one prompt, rules, and an optional first scheduled show before the public community CTA is emphasized.

## Analytics

### North-star metric

Weekly active contributing members who receive a meaningful response or outcome within seven days.

This measures a healthy loop, not content volume.

### Funnel

- channel visitors -> Join;
- members -> first contribution;
- contributions -> first response;
- Ideas -> creator status change;
- marked Moments -> published Moments;
- notifications -> return visit;
- return visit -> live attendance;
- live attendance -> contribution or on-screen participation.

### Guardrails

- unanswered contribution rate;
- median creator response time;
- report rate and upheld-report rate;
- newcomer first-post success rate;
- notification opt-out rate;
- duplicate/spam rate;
- concentration of impressions and reactions among top contributors;
- p95 feed, inbox, and composer latency.

## Delivery plan

### Phase 0: instrument and seed (3-5 days)

- add analytics events to the existing tab, composer, vote, and creator widget;
- stop treating API failure as “no posts”;
- add proper loading, error, and empty states;
- add seeded prompts and creator onboarding checklist;
- capture baseline activation, response, and return metrics.

Exit: the team can distinguish no content, no engagement, and broken delivery.

### Phase 1: make a post become a relationship (2 weeks)

- memberships and Join action;
- user identity/avatar surface;
- post detail routes;
- comments, mentions, post follow;
- creator reply and Idea lifecycle;
- in-app inbox;
- cursor feeds with New/Top and status filters;
- moderation basics, rules, reports, blocks, rate limits;
- creator community inbox replacing the dashboard widget;
- API/integration tests for permissions and lifecycle.

Exit: a contribution can receive a visible creator outcome and bring its author back.

### Phase 2: connect community to the show (2 weeks)

- scheduled shows and reminders;
- studio rundown integration;
- use/feature contribution on stream;
- verified timestamp Moments;
- post-stream recap draft;
- realtime contribution/status updates;
- channel overview modules tied to live and upcoming state.

Exit: community activity visibly changes a live show, and live activity creates durable community content.

### Phase 3: make the network discoverable (1-2 weeks)

- personalized Home;
- Discover for active communities, moments, and rising Ideas;
- channel and topic search;
- relationship/freshness ranking;
- creator update posts;
- notification preferences and digesting;
- contribution impact profile.

Exit: the product remains useful with zero channels live, and discovery produces joined memberships.

### Phase 4: scale trust and learning (ongoing)

- moderator roles and queues;
- merge/duplicate workflows;
- media processing and clip asset pipeline;
- appeals and audit tools;
- ranking experimentation framework;
- email/push delivery after in-app notification quality is proven;
- cohort dashboards and retention experiments.

## Prioritization

### Must build now

- Join/membership;
- comments and creator response;
- Idea lifecycle;
- inbox/notifications;
- post detail URLs;
- creator moderation inbox;
- seeded prompts;
- loading/error/empty-state truthfulness;
- baseline moderation and tests.

### Build next

- scheduled shows;
- studio rundown;
- verified Moments;
- personalized Home and evergreen Discover;
- creator updates;
- realtime community updates.

### Deliberately defer

- DMs;
- open-ended groups/servers;
- points and streaks;
- public downvotes;
- complex follower graph;
- algorithmic video feed;
- monetized memberships;
- native mobile apps.

## Acceptance criteria for “alive”

The revamp is successful when all of these are true:

- a new visitor understands what this community is doing this week within five seconds;
- a viewer can join and make a low-risk first contribution in under one minute;
- every contribution has a durable URL, replies, and a follow state;
- creators have a daily queue of items needing action;
- Ideas show an explicit outcome, not only a vote count;
- live sessions generate at least one reusable community object without manual re-entry;
- users are notified about meaningful responses and can control those notifications;
- Discover has useful content when nobody is live;
- moderation actions are permissioned, auditable, reversible where appropriate, and tested;
- product analytics can measure response loops and seven-day return.

## What not to do

- Do not begin with a visual card refresh while preserving the same empty loop.
- Do not clone Discord or Reddit; both pull the product away from DITCH's show lifecycle.
- Do not launch a global feed before channel membership and moderation are reliable.
- Do not use engagement volume as the only ranking input.
- Do not notify on every reaction.
- Do not call arbitrary links “Moments”; bind them to real DITCH sessions.
- Do not count participant rows as viewers or community presence.
- Do not hide backend errors behind empty states.

## Recommended first build slice

Build one vertical proof before broadening the surface:

1. Viewer joins a channel.
2. Viewer submits an Idea from a seeded prompt.
3. Another member comments/supports it.
4. Creator sees it in Needs reply.
5. Creator responds and marks it Planned.
6. Viewer receives an inbox notification.
7. Creator adds it to the next show rundown.
8. During the stream, the Idea is marked Used on stream.
9. The Idea detail page displays the outcome and linked session.

If this loop feels valuable with ten users, the rest of the system has a sound foundation. If it does not, more feed surfaces will not save it.
