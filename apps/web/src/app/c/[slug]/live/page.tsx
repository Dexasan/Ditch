import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel, LiveSession } from "@ditch/types";
import Studio from "../studio/Studio";

export default async function LivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth");

  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) redirect("/auth");

  const token = authSession.access_token;

  const [result, ownershipResult] = await Promise.all([
    api.get<{ channel: Channel; session: LiveSession | null }>(`/channels/${slug}`).catch(() => null),
    api.get<{ channel: { slug: string } | null }>("/channels/mine", { token }).catch(() => ({ channel: null })),
  ]);

  if (!result) notFound();

  const { channel, session } = result;

  if (!ownershipResult.channel || ownershipResult.channel.slug !== slug) redirect(`/c/${slug}`);
  if (!session || session.status === "ended") redirect("/dashboard");
  if (session.source_type === "rtmp") redirect("/dashboard");

  const creatorName =
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    "Creator";

  return (
    <Studio
      sessionId={session.id}
      channelId={channel.id}
      token="cookie-session"
      creatorName={creatorName}
      channelName={channel.display_name}
      slug={slug}
    />
  );
}
