import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import type { CommunityNotification } from "@ditch/types/src/community";
import ConsoleHeader from "@/components/ConsoleHeader";
import InboxList from "./InboxList";

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");
  const { notifications } = await api
    .get<{ notifications: CommunityNotification[] }>("/community/notifications", { token: session.access_token })
    .catch(() => ({ notifications: [] }));

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <ConsoleHeader active="inbox" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <InboxList initialNotifications={notifications} token={session.access_token} />
      </main>
    </div>
  );
}
