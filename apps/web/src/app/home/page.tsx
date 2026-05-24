import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeCards from "./HomeCards";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");

  const displayName = session.user.user_metadata?.display_name as string | undefined;
  const firstName = displayName?.split(" ")[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080810" }}>
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/5">
        <Link href="/home" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" />
          <span className="text-lg font-bold tracking-tight text-[#FF1DB4]">DITCH</span>
        </Link>
        <Link href="/auth" className="text-xs text-white/30 hover:text-white/60 transition-colors">
          Sign out
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-10">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-white">
              {firstName ? `Hey, ${firstName}.` : "Welcome back."}
            </h1>
            <p className="text-sm text-white/40">What do you want to do?</p>
          </div>
          <HomeCards />
        </div>
      </main>
    </div>
  );
}
