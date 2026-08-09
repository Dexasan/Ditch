"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  CommunityComment,
  CommunityPostDetail,
  CommunityPostStatus,
} from "@ditch/types/src/community";

const STATUS_LABEL: Record<CommunityPostStatus, string> = {
  open: "Open",
  shortlisted: "Shortlisted",
  planned: "Planned",
  used: "Used on stream",
  completed: "Completed",
  declined: "Declined",
};

const NEXT_STATUSES: Record<CommunityPostStatus, CommunityPostStatus[]> = {
  open: ["shortlisted", "declined"],
  shortlisted: ["open", "planned", "declined"],
  planned: ["shortlisted", "used", "completed"],
  used: ["completed"],
  completed: ["open"],
  declined: ["open"],
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function CommunityThread({
  initialDetail,
  token,
  activeSessionId,
}: {
  initialDetail: CommunityPostDetail;
  token: string | null;
  activeSessionId: string | null;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [commentBody, setCommentBody] = useState("");
  const [response, setResponse] = useState(initialDetail.post.creator_response ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinChannel() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/channels/${detail.post.channel_slug}/membership`, { token });
      setDetail((current) => ({ ...current, is_member: true }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not join this channel");
    } finally {
      setBusy(false);
    }
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !commentBody.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api.post<{ comment: CommunityComment }>(
        `/community/posts/${detail.post.id}/comments`,
        { token, body: { body: commentBody.trim() } },
      );
      setDetail((current) => ({
        ...current,
        post: { ...current.post, comment_count: current.post.comment_count + 1 },
        comments: [...current.comments, comment],
      }));
      setCommentBody("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not add this reply");
    } finally {
      setBusy(false);
    }
  }

  async function creatorAction(input: { response?: string; status?: CommunityPostStatus; session_id?: string }) {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ updated: boolean; status: CommunityPostStatus }>(
        `/community/posts/${detail.post.id}/creator-action`,
        { token, body: input },
      );
      setDetail((current) => ({
        ...current,
        post: {
          ...current.post,
          status: result.status,
          creator_response: input.response ?? current.post.creator_response,
        },
      }));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not update this contribution");
    } finally {
      setBusy(false);
    }
  }

  const { post } = detail;
  const canReply = Boolean(token && (detail.is_member || detail.is_owner));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href={`/c/${post.channel_slug}?tab=community`} className="text-xs font-semibold text-white/35 hover:text-white">
        ← Back to community
      </Link>

      {error && <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">{error}</div>}

      <article className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
          <span className="text-[#FF75CD]">{post.type === "suggestion" ? "Idea" : post.type}</span>
          {post.type === "suggestion" && <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">{STATUS_LABEL[post.status]}</span>}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{post.title}</h1>
        {post.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/55">{post.body}</p>}
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/30">
          <span>{post.author_display_name}</span>
          <span>{formatDate(post.created_at)}</span>
          <span>{post.vote_count} support</span>
          <span>{post.comment_count} replies</span>
        </div>

        {post.creator_response && (
          <section className="mt-6 rounded-xl border border-[#FF1DB4]/20 bg-[#FF1DB4]/[0.07] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF75CD]">Creator response</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{post.creator_response}</p>
          </section>
        )}

        {detail.events.length > 0 && (
          <section className="mt-6 border-t border-white/8 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Outcome history</p>
            <div className="mt-3 space-y-2">
              {detail.events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#FF1DB4]" />
                  <div>
                    <p className="text-white/60">
                      {event.event_type === "status_change" && event.to_status
                        ? `${event.actor_display_name} moved this to ${STATUS_LABEL[event.to_status]}`
                        : event.event_type === "added_to_rundown"
                          ? `${event.actor_display_name} added this to the show rundown`
                          : event.event_type === "used_on_stream"
                            ? `${event.actor_display_name} used this on stream`
                            : `${event.actor_display_name} responded`}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/25">{formatDate(event.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </article>

      {detail.is_owner && (
        <section className="mt-4 rounded-xl border border-[#FF1DB4]/20 bg-[#FF1DB4]/[0.04] p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF75CD]">Creator actions</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-white/55" htmlFor="creator-response">Public response</label>
              <textarea
                id="creator-response"
                rows={4}
                maxLength={2000}
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#FF1DB4]/50 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !response.trim()}
                onClick={() => creatorAction({ response: response.trim() })}
                className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
              >
                Publish response
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/55">Move idea</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {NEXT_STATUSES[post.status].map((status) => (
                  <button
                    type="button"
                    key={status}
                    disabled={busy}
                    onClick={() => creatorAction({ status })}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:border-[#FF1DB4]/40 hover:text-white"
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              {activeSessionId && post.type === "suggestion" && post.status !== "used" && post.status !== "completed" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => creatorAction({ session_id: activeSessionId })}
                  className="mt-4 w-full rounded-lg bg-[#FF1DB4] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  Add to active show rundown
                </button>
              )}
              {!activeSessionId && <p className="mt-3 text-xs text-white/30">Start a live session to add this Idea to a rundown.</p>}
            </div>
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Discussion</p><h2 className="mt-1 text-lg font-bold text-white">{detail.comments.length} replies</h2></div>
        </div>

        <div className="mt-3 space-y-2">
          {detail.comments.map((comment) => (
            <article key={comment.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs"><strong className="text-white/70">{comment.author_display_name}</strong><span className="text-white/25">{formatDate(comment.created_at)}</span></div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{comment.body}</p>
            </article>
          ))}
        </div>

        {canReply ? (
          <form onSubmit={addComment} className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-4">
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add a useful reply"
              className="w-full resize-y bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
            />
            <div className="mt-2 flex justify-end"><button disabled={busy || !commentBody.trim()} className="rounded-lg bg-[#FF1DB4] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Reply</button></div>
          </form>
        ) : token ? (
          <button type="button" onClick={joinChannel} disabled={busy} className="mt-4 rounded-lg bg-[#FF1DB4] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Join the channel to reply</button>
        ) : (
          <p className="mt-4 text-sm text-white/35"><Link href="/auth" className="text-[#FF75CD]">Sign in</Link> and join the channel to reply.</p>
        )}
      </section>
    </div>
  );
}
