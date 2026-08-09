"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function ChannelSubscribeButton({
  channelSlug,
  token,
  initialSubscribed,
  initialCount,
  isOwner = false,
  compact = false,
}: {
  channelSlug: string;
  token: string | null;
  initialSubscribed: boolean;
  initialCount: number;
  isOwner?: boolean;
  compact?: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [subscriberCount, setSubscriberCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscriberLabel = `${subscriberCount} ${subscriberCount === 1 ? "subscriber" : "subscribers"}`;

  async function toggleSubscription() {
    if (!token || busy || isOwner) return;

    const nextSubscribed = !subscribed;
    setSubscribed(nextSubscribed);
    setSubscriberCount((count) => Math.max(0, count + (nextSubscribed ? 1 : -1)));
    setBusy(true);
    setError(null);

    try {
      if (nextSubscribed) {
        await api.post(`/channels/${channelSlug}/membership`, { token, body: {} });
      } else {
        await api.delete(`/channels/${channelSlug}/membership`, { token });
      }
    } catch (caught) {
      setSubscribed(!nextSubscribed);
      setSubscriberCount((count) => Math.max(0, count + (nextSubscribed ? -1 : 1)));
      setError(caught instanceof ApiError ? caught.message : "Could not update subscription");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = compact
    ? "rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors"
    : "rounded-lg px-4 py-2 text-xs font-bold transition-colors";
  const stateClass = subscribed
    ? "border border-white/12 bg-white/[0.04] text-white/75 hover:border-white/25 hover:text-white"
    : "bg-[#D9217F] text-white hover:bg-[#F02D96]";

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <span className="whitespace-nowrap text-xs font-medium text-white/60">{subscriberLabel}</span>
      {isOwner ? (
        <span className={`${buttonClass} border border-white/10 text-white/55`}>Your channel</span>
      ) : token ? (
        <button
          type="button"
          onClick={toggleSubscription}
          disabled={busy}
          aria-pressed={subscribed}
          title={subscribed ? "Unsubscribe from this channel" : "Subscribe to this channel for free"}
          className={`${buttonClass} ${stateClass} disabled:cursor-wait disabled:opacity-60`}
        >
          {busy ? "Saving..." : subscribed ? "Subscribed" : "Subscribe"}
        </button>
      ) : (
        <Link href="/auth" className={`${buttonClass} bg-[#D9217F] text-white hover:bg-[#F02D96]`}>
          Subscribe
        </Link>
      )}
      {error && <span role="status" className="basis-full text-right text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
