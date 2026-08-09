"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CommunityPostType } from "@ditch/types";
import type { CommunityPostStatus, CommunityPostV2 } from "@ditch/types/src/community";

const TYPE_LABEL: Record<CommunityPostType, string> = {
  suggestion: "Idea",
  discussion: "Conversation",
  moment: "Moment",
};

const STATUS_LABEL: Record<CommunityPostStatus, string> = {
  open: "Open",
  shortlisted: "Shortlisted",
  planned: "Planned",
  used: "Used on stream",
  completed: "Completed",
  declined: "Declined",
};

const FILTERS: Array<{ label: string; value: CommunityPostType | "all" }> = [
  { label: "For you", value: "all" },
  { label: "Ideas", value: "suggestion" },
  { label: "Conversations", value: "discussion" },
  { label: "Moments", value: "moment" },
];

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function CommunityBoard({
  channelSlug,
  initialPosts,
  token,
  initialIsMember,
  initialMemberCount,
  isOwner,
}: {
  channelSlug: string;
  initialPosts: CommunityPostV2[];
  token: string | null;
  initialIsMember: boolean;
  initialMemberCount: number;
  isOwner: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [filter, setFilter] = useState<CommunityPostType | "all">("all");
  const [joined, setJoined] = useState(initialIsMember || isOwner);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [joining, setJoining] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [type, setType] = useState<CommunityPostType>("suggestion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visiblePosts = useMemo(
    () => filter === "all" ? posts : posts.filter((post) => post.type === filter),
    [filter, posts],
  );

  async function toggleMembership() {
    if (!token || joining || isOwner) return;
    setJoining(true);
    setError(null);
    try {
      if (joined) {
        await api.delete(`/channels/${channelSlug}/membership`, { token });
        setJoined(false);
        setMemberCount((count) => Math.max(0, count - 1));
      } else {
        await api.post(`/channels/${channelSlug}/membership`, { token, body: {} });
        setJoined(true);
        setMemberCount((count) => count + 1);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not update subscription");
    } finally {
      setJoining(false);
    }
  }

  async function toggleVote(post: CommunityPostV2) {
    if (!token) return;
    try {
      const result = await api.post<{ voted: boolean; vote_count: number }>(
        `/community/posts/${post.id}/vote`,
        { token },
      );
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, user_voted: result.voted, vote_count: result.vote_count }
        : item));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not support this post");
    }
  }

  async function createPost(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ post: CommunityPostV2 }>(
        `/channels/${channelSlug}/community-v2`,
        { token, body: { type, title: title.trim(), body: body.trim() || undefined } },
      );
      setPosts((current) => [result.post, ...current]);
      setTitle("");
      setBody("");
      setComposerOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not publish this post");
    } finally {
      setSubmitting(false);
    }
  }

  const canContribute = Boolean(token && joined);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#FF1DB4] font-bold">Community board</p>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold text-white">Shape what happens next.</h1>
            <p className="mt-1 text-sm text-white/70 max-w-xl">
              Share an idea, continue the conversation, or save a moment from the show. Creator decisions stay attached to every contribution.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">{memberCount} {memberCount === 1 ? "subscriber" : "subscribers"}</span>
            {token ? (
              <button
                type="button"
                onClick={toggleMembership}
                disabled={joining || isOwner}
                aria-pressed={joined}
                title={joined && !isOwner ? "Unsubscribe from this channel" : undefined}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${joined ? "border border-white/10 text-white/60 hover:text-white" : "bg-[#FF1DB4] text-white hover:bg-[#ff45c0]"}`}
              >
                {isOwner ? "Your channel" : joined ? "Subscribed" : "Subscribe"}
              </button>
            ) : (
              <Link href="/auth" className="rounded-lg bg-[#FF1DB4] px-4 py-2 text-xs font-bold text-white">Subscribe</Link>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <main className="min-w-0">
          {canContribute ? (
            composerOpen ? (
              <form onSubmit={createPost} className="mb-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["suggestion", "discussion", "moment"] as CommunityPostType[]).map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setType(item)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${type === item ? "border-[#FF1DB4]/40 bg-[#FF1DB4]/10 text-[#FF75CD]" : "border-white/8 text-white/60"}`}
                    >
                      {TYPE_LABEL[item]}
                    </button>
                  ))}
                </div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  required
                  placeholder={type === "suggestion" ? "What should happen on the next show?" : "Give this contribution a clear title"}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-[#FF1DB4]/50 focus:outline-none"
                />
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Add enough context for people to respond"
                  className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-[#FF1DB4]/50 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setComposerOpen(false)} className="px-3 py-2 text-xs text-white/65">Cancel</button>
                  <button disabled={submitting || !title.trim()} className="rounded-lg bg-[#FF1DB4] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                    {submitting ? "Publishing..." : `Publish ${TYPE_LABEL[type].toLowerCase()}`}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="mb-4 w-full rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left text-sm text-white/60 hover:border-white/15 hover:text-white/60"
              >
                Suggest something, start a conversation, or mark a moment...
              </button>
            )
          ) : (
            <div className="mb-4 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-sm text-white/60">
              {token ? "Subscribe to contribute and reply." : <><Link href="/auth" className="text-[#FF75CD]">Sign in</Link> and subscribe to contribute.</>}
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === item.value ? "bg-white/10 text-white" : "text-white/60 hover:text-white/60"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {visiblePosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-white/60">Start with one useful contribution.</p>
              <p className="mt-1 text-xs text-white/55">Ask what should happen next, rather than posting into an empty feed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visiblePosts.map((post) => (
                <article key={post.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => toggleVote(post)}
                      disabled={!token}
                      className={`h-fit min-w-12 rounded-lg border px-2 py-2 text-center text-xs font-bold uppercase disabled:opacity-40 ${post.user_voted ? "border-[#FF1DB4]/35 bg-[#FF1DB4]/10 text-[#FF75CD]" : "border-white/8 text-white/60"}`}
                    >
                      Support
                      <strong className="mt-0.5 block text-sm text-white">{post.vote_count}</strong>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <span className="text-[#FF75CD]">{TYPE_LABEL[post.type]}</span>
                        {post.type === "suggestion" && (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-300">{STATUS_LABEL[post.status]}</span>
                        )}
                      </div>
                      <Link href={`/c/${channelSlug}/community/${post.id}`} className="group block">
                        <h2 className="mt-2 text-base font-semibold text-white group-hover:text-[#FF75CD]">{post.title}</h2>
                        {post.body && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-white/70">{post.body}</p>}
                      </Link>
                      {post.creator_response && (
                        <div className="mt-3 rounded-r-lg border-l-2 border-[#FF1DB4] bg-[#FF1DB4]/[0.06] px-3 py-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#FF75CD]">Creator response</p>
                          <p className="mt-1 text-xs text-white/60">{post.creator_response}</p>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/50">
                        <span>{post.author_display_name}</span>
                        <span>{timeAgo(post.created_at)}</span>
                        <span>{post.comment_count} {post.comment_count === 1 ? "reply" : "replies"}</span>
                        <Link href={`/c/${channelSlug}/community/${post.id}`} className="text-white/70 hover:text-white">Open thread</Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <aside className="space-y-3">
          <section className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Start here</p>
            <h2 className="mt-2 text-sm font-semibold text-white">What should happen next?</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60">Suggest one specific change or challenge. The creator can reply, plan it, and mark it used on stream.</p>
          </section>
          <section className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Idea stages</p>
            <div className="mt-3 space-y-2 text-xs text-white/70">
              {(["open", "shortlisted", "planned", "used"] as CommunityPostStatus[]).map((status) => (
                <div key={status} className="flex justify-between border-b border-white/5 pb-2 last:border-0">
                  <span>{STATUS_LABEL[status]}</span>
                  <strong className="text-white/70">{posts.filter((post) => post.status === status).length}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
