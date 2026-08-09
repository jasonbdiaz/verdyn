"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const params = useSearchParams();
  const expired = params.get("error") === "expired";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error || "Something went wrong.");
        return;
      }
      setStatus("sent");
      if (json.devLink) setDevLink(json.devLink as string);
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-pine/5">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center">
          <Link href="/"><Logo /></Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="display text-3xl font-bold text-center">Sign in to Verdyn</h1>
          <p className="mt-2 text-center text-pine/65 text-sm">
            We&apos;ll email you a secure sign-in link — no password.
          </p>

          {expired && status === "idle" && (
            <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              That link expired or was already used. Request a fresh one below.
            </p>
          )}

          {status === "sent" ? (
            <div className="mt-8 rounded-2xl bg-cloud border border-pine/10 p-6 text-center">
              <div className="text-3xl">📬</div>
              <p className="mt-3 font-semibold">Check your email</p>
              <p className="mt-1 text-sm text-pine/65">
                If an account matches <span className="font-medium">{email}</span>, a sign-in link is on its way. It expires in 15 minutes.
              </p>
              {devLink && (
                <div className="mt-4 rounded-xl bg-mist border border-pine/10 p-3 text-left">
                  <p className="text-xs font-semibold text-pine/60">Dev mode — email isn&apos;t configured yet:</p>
                  <a href={devLink} className="mt-1 block break-all text-xs text-green underline">{devLink}</a>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-pine/15 px-4 py-3 outline-none focus:border-green"
              />
              {status === "error" && <p className="text-sm text-red-600">{message}</p>}
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-full px-6 py-3 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-pine/50">
            New here? <Link href="/pricing" className="text-green underline">See plans</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
