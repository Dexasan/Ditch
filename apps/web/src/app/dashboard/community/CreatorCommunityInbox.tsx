"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CommunityPostV2 } from "@ditch/types/src/community";

export default function CreatorCommunityInbox({
  channelSlug,
  token,
  initialPosts,
  activeSessionId,
}: {
  channelSlug: string;
  token: string;
  initialPosts: CommunityPostV2[];
  activeSessionId: string | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addToShow(post: CommunityPostV2) {
    if (!activeSessionId || busyId) return;
    setBusyId(post.id);
    setError(null);
    try {
      await api.post(`/community/posts/${post.id}/creator-action`, {
        token,
        body: { session_id: activeSessionId },
      });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: "planned" } : item));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not add this Idea to the show");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">{error}</div>}
      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-white/60">Your community queue is clear.</p>
          <p className="mt-1 text-xs text-white/30">New Ideas and conversations needing attention will appear here.</p>
        </div>
      ) : posts.map((post) => (
        <article key={post.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                <span className="text-[#FF75CD]">{post.type === "suggestion" ? "Idea" : post.type}</span>
                <span className="text-emerald-300">{post.status}</span>
              </div>
              <Link href={`/c/${channelSlug}/community/${post.id}`} className="group block">
                <h2 className="mt-2 text-base font-semibold text-white group-hover:text-[#FF75CD]">{post.title}</h2>
                {post.body && <p className="mt-1 line-clamp-2 text-sm text-white/40">{post.body}</p>}
              </Link>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/25">
                <span>{post.author_display_name}</span><span>{post.vote_count} support</span><span>{post.comment_count} replies</span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/c/${channelSlug}/community/${post.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 hover:text-white">Review</Link>
              {activeSessionId && post.type === "suggestion" && post.status !== "planned" && (
                <button type="button" disabled={busyId === post.id} onClick={() => addToShow(post)} className="rounded-lg bg-[#FF1DB4] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                  {busyId === post.id ? "Adding..." : "Add to show"}
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
