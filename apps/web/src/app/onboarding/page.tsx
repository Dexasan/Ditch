import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { Channel } from "@ditch/types";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/auth");

  // Returning users with a channel skip onboarding
  try {
    const { channel } = await api.get<{ channel: Channel | null }>("/channels/mine", {
      token: session.access_token,
    });
    if (channel) redirect("/dashboard");
  } catch {
    // No channel found — continue to onboarding form
  }

  const displayName =
    session.user.user_metadata?.display_name ??
    session.user.email?.split("@")[0] ??
    "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Set up your channel</h1>
          <p className="text-[var(--color-text-muted)] text-sm">
            You only do this once. Choose your handle carefully.
          </p>
        </div>
        <OnboardingForm defaultDisplayName={displayName} />
      </div>
    </div>
  );
}
