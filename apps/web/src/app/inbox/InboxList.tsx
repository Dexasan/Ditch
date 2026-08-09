"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { CommunityNotification } from "@ditch/types/src/community";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function InboxList({ initialNotifications, token }: { initialNotifications: CommunityNotification[]; token: string }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((notification) => !notification.read_at);

  async function markAllRead() {
    if (unread.length === 0) return;
    await api.patch("/community/notifications/read", { token, body: {} });
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => notification.read_at ? notification : { ...notification, read_at: readAt }));
  }

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF75CD]">Inbox</p><h1 className="mt-2 text-3xl font-bold text-white">Meaningful updates.</h1><p className="mt-1 text-sm text-white/35">Replies, creator decisions, and Ideas used on stream.</p></div>
        {unread.length > 0 && <button type="button" onClick={markAllRead} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 hover:text-white">Mark all read</button>}
      </div>
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-white/35">Nothing needs your attention yet.</div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const href = notification.post_id
              ? `/c/${notification.channel_slug}/community/${notification.post_id}`
              : `/c/${notification.channel_slug}?tab=community`;
            return (
              <Link key={notification.id} href={href} className={`block rounded-xl border p-4 transition-colors hover:border-white/15 ${notification.read_at ? "border-white/6 bg-white/[0.015]" : "border-[#FF1DB4]/20 bg-[#FF1DB4]/[0.05]"}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-white/15" : "bg-[#FF1DB4]"}`} />
                  <div className="min-w-0"><p className="text-sm font-semibold text-white/75">{notification.body}</p><p className="mt-1 text-xs text-white/30">{notification.channel_display_name} · {formatDate(notification.created_at)}</p></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
