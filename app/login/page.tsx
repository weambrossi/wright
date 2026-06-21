"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Incorrect password");
      }
      const from =
        new URLSearchParams(window.location.search).get("from") || "/";
      router.replace(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-cream-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="font-serif italic text-5xl text-ink-900 tracking-tight">
          Wright
        </div>
        <div className="mt-3 text-ink-500 text-sm">
          Enter the password to continue.
        </div>
        <form onSubmit={submit} className="mt-8 w-full flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Password"
            className="w-full rounded-modal border border-cream-300 bg-white px-4 py-3 text-ink-900 outline-none focus:border-amber-accent"
          />
          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-modal bg-amber-accent px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Checking…" : "Enter"}
          </button>
        </form>
        {error && <div className="mt-3 text-sm text-red-soft">{error}</div>}
      </div>
    </main>
  );
}
