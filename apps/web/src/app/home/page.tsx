import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/auth");

  const displayName = session.user.user_metadata?.display_name as string | undefined;
  const firstName = displayName?.split(" ")[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080810" }}>
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/5">
        <Link href="/home" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="DITCH" className="h-7 w-7 rounded-md" />
          <span className="text-lg font-bold tracking-tight text-[#FF1DB4]">DITCH</span>
        </Link>
        <Link href="/auth" className="text-xs text-white/30 hover:text-white/60 transition-colors">
          Sign out
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-10">
          {/* Greeting */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-white">
              {firstName ? `Hey, ${firstName}.` : "Welcome back."}
            </h1>
            <p className="text-sm text-white/40">What do you want to do?</p>
          </div>

          {/* Choice cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Explore */}
            <Link href="/explore"
              className="group relative flex flex-col overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: "linear-gradient(145deg, #0e0e1e 0%, #141428 100%)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 50px rgba(0,229,212,0.06)" }} />

              <div className="mb-5 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,229,212,0.1)", border: "1px solid rgba(0,229,212,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: "#00E5D4" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>

              <h2 className="text-lg font-bold text-white mb-1">Explore</h2>
              <p className="text-sm text-white/40 leading-relaxed flex-1">
                Watch live streams from creators broadcasting across every platform at once.
              </p>

              <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: "#00E5D4" }}>
                Browse live streams
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </Link>

            {/* Studio */}
            <Link href="/dashboard"
              className="group relative flex flex-col overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: "linear-gradient(145deg, #0e0e1e 0%, #1a0e1a 100%)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 50px rgba(255,29,180,0.07)" }} />

              <div className="mb-5 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,29,180,0.1)", border: "1px solid rgba(255,29,180,0.15)" }}>
                <svg className="w-5 h-5 text-[#FF1DB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
                </svg>
              </div>

              <h2 className="text-lg font-bold text-white mb-1">Studio</h2>
              <p className="text-sm text-white/40 leading-relaxed flex-1">
                Go live, manage your stream destinations, and bring viewers on screen.
              </p>

              <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-[#FF1DB4] transition-colors">
                Open your studio
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
