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
    <main className="flex min-h-screen w-full flex-col bg-neutral-200">
      <header className="flex h-12 shrink-0 items-center border-b border-neutral-300 bg-white px-4">
        <span className="font-serif text-lg italic text-neutral-700">Wright</span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-lg border border-neutral-300 bg-white p-6 shadow-paper">
          <div className="font-serif text-2xl italic text-neutral-800">
            Wright
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            Enter the password to continue.
          </div>
          <form onSubmit={submit} className="mt-5 flex w-full flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Password"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
          />
          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Checking…" : "Enter"}
          </button>
          </form>
          {error && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
