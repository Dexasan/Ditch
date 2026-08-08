"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { api, ApiError } from "@/lib/api";

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function OnboardingForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlug(slugify(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth");
      return;
    }

    // Update display name in Supabase user metadata
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });

    try {
      await api.post("/channels", {
        token: session.access_token,
        body: { slug, display_name: displayName.trim() },
      });
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm text-[var(--color-text-muted)]" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          required
          minLength={1}
          maxLength={64}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name on stream"
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-[var(--color-text-muted)]" htmlFor="slug">
          Channel handle
        </label>
        <div className="flex items-center rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] focus-within:border-[var(--color-brand)] transition-colors overflow-hidden">
          <span className="pl-3 pr-1 text-sm text-[var(--color-text-muted)] shrink-0">ditchlive.app/c/</span>
          <input
            id="slug"
            type="text"
            required
            minLength={2}
            maxLength={32}
            value={slug}
            onChange={handleSlugChange}
            placeholder="your-handle"
            className="flex-1 py-2.5 pr-3 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Lowercase letters, numbers, and hyphens only. Can&apos;t be changed later.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || slug.length < 2}
        className="w-full py-2.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Setting up..." : "Create my channel"}
      </button>
    </form>
  );
}
