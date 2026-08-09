"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CommunityRundownItem } from "@ditch/types/src/community";

export default function RundownPanel({ sessionId, token }: { sessionId: string; token: string }) {
  const [items, setItems] = useState<CommunityRundownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.get<{ items: CommunityRundownItem[] }>(`/sessions/${sessionId}/rundown`, { token });
      setItems(result.items);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load rundown");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function markUsed(item: CommunityRundownItem) {
    if (busyId || item.state === "used") return;
    setBusyId(item.id);
    try {
      const result = await api.post<{ used: boolean; used_at: string }>(
        `/sessions/${sessionId}/rundown/${item.id}/use`,
        { token },
      );
      setItems((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, state: "used", used_at: result.used_at }
        : entry));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not mark Idea as used");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="p-4 text-[11px] text-[var(--text-muted)]">Loading rundown...</div>;

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {error && <div className="m-3 rounded border border-red-500/20 bg-red-500/10 p-2 text-[10px] text-red-300">{error}</div>}
      {items.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-[11px] text-[var(--text-muted)]">No Ideas in this show yet</p>
          <a href="/dashboard/community" className="text-[10px] font-semibold text-[var(--accent-primary)]">Open community inbox</a>
        </div>
      ) : items.map((item, index) => (
        <article key={item.id} className="space-y-2 border-b border-[var(--border)] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">Segment {(index + 1).toString().padStart(2, "0")}</span>
            <span className={`text-[9px] font-bold uppercase ${item.state === "used" ? "text-green-400" : "text-[var(--text-muted)]"}`}>{item.state}</span>
          </div>
          <p className="text-[11px] font-semibold leading-snug text-[var(--text-primary)]">{item.title}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{item.author_display_name} · {item.vote_count} support · {item.comment_count} replies</p>
          <button type="button" disabled={busyId === item.id || item.state === "used"} onClick={() => markUsed(item)} className="w-full rounded border border-[var(--accent-primary)] px-2 py-1.5 text-[10px] font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)] hover:text-white disabled:opacity-40">
            {item.state === "used" ? "Used on stream" : busyId === item.id ? "Updating..." : "Mark used on stream"}
          </button>
        </article>
      ))}
    </div>
  );
}
