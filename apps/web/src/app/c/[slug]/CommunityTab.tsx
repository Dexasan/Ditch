"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CommunityPost, CommunityPostType } from "@ditch/types";

const TYPE_LABELS: Record<CommunityPostType, string> = {
  suggestion: "Suggestion",
  discussion: "Discussion",
  moment:     "Moment",
};

const TYPE_COLORS: Record<CommunityPostType, { text: string; bg: string }> = {
  suggestion: { text: "#FF1DB4", bg: "rgba(255,29,180,0.1)" },
  discussion: { text: "#00E5D4", bg: "rgba(0,229,212,0.1)" },
  moment:     { text: "#9146FF", bg: "rgba(145,70,255,0.1)" },
};

const FILTERS: { label: string; value: CommunityPostType | "all" }[] = [
  { label: "All",         value: "all" },
  { label: "Suggestions", value: "suggestion" },
  { label: "Discussions", value: "discussion" },
  { label: "Moments",     value: "moment" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── Vote button ─────────────────────────────────────────────────────── */

function VoteButton({
  postId,
  voted,
  count,
  token,
  onToggle,
}: {
  postId: string;
  voted: boolean;
  count: number;
  token: string | null;
  onToggle: (postId: string, voted: boolean, count: number) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleVote(e: React.MouseEvent) {
    e.preventDefault();
    if (!token || loading) return;
    setLoading(true);
    try {
      const res = await api.post<{ voted: boolean; vote_count: number }>(
        `/community/posts/${postId}/vote`,
        { token }
      );
      onToggle(postId, res.voted, res.vote_count);
    } catch {
      // silent - vote failed, state unchanged
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={!token || loading}
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200 shrink-0"
      style={{
        background: voted ? "rgba(255,29,180,0.12)" : "rgba(255,255,255,0.04)",
        border: voted ? "1px solid rgba(255,29,180,0.3)" : "1px solid rgba(255,255,255,0.07)",
        color: voted ? "#FF1DB4" : "rgba(255,255,255,0.4)",
        cursor: token ? "pointer" : "default",
        opacity: loading ? 0.6 : 1,
      }}
      title={token ? (voted ? "Remove vote" : "Vote") : "Sign in to vote"}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      <span className="text-xs font-semibold leading-none">{count}</span>
    </button>
  );
}

/* ─── Post card ───────────────────────────────────────────────────────── */

function PostCard({
  post,
  token,
  onVoteToggle,
}: {
  post: CommunityPost;
  token: string | null;
  onVoteToggle: (postId: string, voted: boolean, count: number) => void;
}) {
  const colors = TYPE_COLORS[post.type];

  return (
    <div
      className="flex gap-3 p-4 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <VoteButton
        postId={post.id}
        voted={post.user_voted}
        count={post.vote_count}
        token={token}
        onToggle={onVoteToggle}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {post.is_pinned && (
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#FF1DB4] opacity-70">
              Pinned
            </span>
          )}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: colors.text, background: colors.bg }}
          >
            {TYPE_LABELS[post.type]}
          </span>
        </div>

        <p className="text-sm font-medium text-white leading-snug mb-1">{post.title}</p>

        {post.body && (
          <p className="text-xs text-white/45 leading-relaxed line-clamp-2">{post.body}</p>
        )}

        <p className="text-[11px] text-white/25 mt-2">
          {post.author_display_name} · {timeAgo(post.created_at)}
        </p>
      </div>
    </div>
  );
}

/* ─── Create post form ────────────────────────────────────────────────── */

function CreatePostForm({
  channelSlug,
  token,
  onCreated,
}: {
  channelSlug: string;
  token: string | null;
  onCreated: (post: CommunityPost) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [type, setType]     = useState<CommunityPostType>("suggestion");
  const [title, setTitle]   = useState("");
  const [body, setBody]     = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p className="text-xs text-white/30 text-center py-2">
        Sign in to post
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        + Add a post
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { post } = await api.post<{ post: CommunityPost }>(
        `/channels/${channelSlug}/community`,
        { token: token ?? undefined, body: { type, title: title.trim(), body: body.trim() || undefined } }
      );
      onCreated(post);
      setTitle("");
      setBody("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Type selector */}
      <div className="flex gap-2">
        {(["suggestion", "discussion", "moment"] as CommunityPostType[]).map((t) => {
          const c = TYPE_COLORS[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: type === t ? c.bg : "transparent",
                color: type === t ? c.text : "rgba(255,255,255,0.3)",
                border: type === t ? `1px solid ${c.text}40` : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>

      <input
        required
        maxLength={120}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent text-sm text-white placeholder-white/25 focus:outline-none border-b border-white/10 pb-1"
      />

      <textarea
        rows={2}
        maxLength={500}
        placeholder="More details (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full bg-transparent text-sm text-white/70 placeholder-white/20 focus:outline-none resize-none"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-white/30 hover:text-white/60 px-3 py-1.5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white transition-opacity disabled:opacity-40"
          style={{ background: "#FF1DB4" }}
        >
          {loading ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */

export default function CommunityTab({
  channelSlug,
  initialPosts,
  token,
}: {
  channelSlug: string;
  initialPosts: CommunityPost[];
  token: string | null;
}) {
  const [posts, setPosts]   = useState<CommunityPost[]>(initialPosts);
  const [filter, setFilter] = useState<CommunityPostType | "all">("all");

  function handleVoteToggle(postId: string, voted: boolean, vote_count: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, user_voted: voted, vote_count } : p))
    );
  }

  function handleCreated(post: CommunityPost) {
    setPosts((prev) => [post, ...prev]);
  }

  const visible = filter === "all" ? posts : posts.filter((p) => p.type === filter);

  return (
    <div className="flex flex-col gap-4 py-6 px-6 max-w-2xl mx-auto w-full">
      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: filter === f.value ? "rgba(255,29,180,0.12)" : "rgba(255,255,255,0.04)",
              color: filter === f.value ? "#FF1DB4" : "rgba(255,255,255,0.4)",
              border: filter === f.value ? "1px solid rgba(255,29,180,0.25)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      <CreatePostForm channelSlug={channelSlug} token={token} onCreated={handleCreated} />

      {/* Post list */}
      {visible.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-8">
          {filter === "all" ? "No posts yet. Be the first." : `No ${filter}s yet.`}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              token={token}
              onVoteToggle={handleVoteToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
