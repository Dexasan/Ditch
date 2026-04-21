"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
    >
      Sign out
    </button>
  );
}
