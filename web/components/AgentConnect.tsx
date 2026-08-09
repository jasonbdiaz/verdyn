"use client";

// "Connect your AI agent" — the Expert (agentic) tier's dashboard panel.
// Mints/revokes the account's MCP agent key and shows the connector URL with
// copy-paste instructions for Claude and ChatGPT. The key is displayed ONCE.

import { useCallback, useEffect, useState } from "react";

interface KeyInfo { exists: boolean; createdAt?: string; lastUsedAt?: string | null }

export default function AgentConnect() {
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-key");
      if (r.ok) setInfo(await r.json());
    } catch { /* panel simply stays hidden */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (!info) return null;

  const mint = async () => {
    if (info.exists && !confirm("Re-generating replaces your existing key — any connected agent must be updated. Continue?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/agent-key", { method: "POST" });
      if (r.ok) {
        const j = await r.json();
        setFreshUrl(j.mcpUrl);
        await refresh();
      }
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!confirm("Revoke the agent key? Connected agents lose access immediately.")) return;
    setBusy(true);
    try {
      await fetch("/api/agent-key", { method: "DELETE" });
      setFreshUrl(null);
      await refresh();
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!freshUrl) return;
    await navigator.clipboard.writeText(freshUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-xl font-bold">Connect your AI agent</h2>
        {info.exists && !freshUrl && (
          <span className="rounded-full bg-sprout/15 px-3 py-1 text-xs font-semibold text-pine">
            key active{info.lastUsedAt ? " · used recently" : ""}
          </span>
        )}
      </div>

      <div className="rounded-xl bg-cloud border border-pine/5 px-4 py-4">
        <p className="text-sm text-pine/65">
          Verdyn speaks <span className="font-medium text-pine">MCP</span> — connect Claude or ChatGPT
          and manage your watering program by conversation: &ldquo;why did we skip today?&rdquo;,
          &ldquo;set the back zone to shade&rdquo;, &ldquo;pause watering while I reseed.&rdquo;
        </p>

        {freshUrl && (
          <div className="mt-4 rounded-lg bg-clay/10 border border-clay/25 p-4">
            <p className="text-sm font-semibold text-pine">
              Your connector URL — shown once, copy it now:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="block flex-1 overflow-x-auto rounded-lg bg-mist px-3 py-2 text-xs text-pine">{freshUrl}</code>
              <button onClick={copy}
                className="rounded-full brand-gradient px-4 py-2 text-xs font-semibold text-cloud hover:opacity-90 transition">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-pine/70">
              <li><b>Claude</b>: Settings → Connectors → Add custom connector → paste the URL.</li>
              <li><b>ChatGPT</b>: Settings → Connectors → Add MCP server → paste the URL.</li>
              <li>Then ask: &ldquo;What&apos;s my watering plan today, and why?&rdquo;</li>
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={mint} disabled={busy}
            className="rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-cloud hover:opacity-90 transition disabled:opacity-50">
            {info.exists ? "Re-generate key" : "Generate agent key"}
          </button>
          {info.exists && (
            <button onClick={revoke} disabled={busy}
              className="rounded-full px-5 py-2 text-sm font-semibold text-pine border border-pine/15 hover:border-ember/40 hover:text-ember transition disabled:opacity-50">
              Revoke
            </button>
          )}
          <a href="/docs/agent" className="ml-auto text-sm font-medium text-pine/70 hover:text-pine underline underline-offset-2">
            Setup guide →
          </a>
        </div>
      </div>
    </section>
  );
}
