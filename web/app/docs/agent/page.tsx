// Expert (agentic) tier — setup guide for connecting Claude / ChatGPT to the
// account's MCP endpoint.
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Connect Claude or ChatGPT to Your Sprinkler System — Verdyn",
  description:
    "Control your smart sprinklers from Claude or ChatGPT. Verdyn gives every account a personal MCP endpoint, so your AI assistant can read, explain, and adjust your watering program.",
};

const TOOL_LIST = [
  ["get_status", "controller link, tier, and the full lawn profile"],
  ["get_daily_plan", "today's cycles + the plain-English rationale"],
  ["get_week_preview", "7-day schedule preview"],
  ["update_profile", "ZIP, soil, address parity, planting date"],
  ["update_zone", "per-zone grass, nozzle, sun, slope, area, planting date"],
  ["set_auto_run", "pause / resume automatic watering"],
  ["get_run_history", "what actually ran, was skipped, or errored"],
];

export default function AgentDocs() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/"><Logo size={26} /></Link>
          <Link href="/dashboard" className="text-sm font-medium text-pine/60 hover:text-pine">Dashboard</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-pine">Connect Claude or ChatGPT to your sprinkler system</h1>
          <p className="mt-3 text-pine/70">
            Yes — your AI assistant can run your sprinklers. Verdyn's Expert tier is <b>agent-native</b>:
            your account exposes a personal
            {" "}<a className="underline underline-offset-2" href="https://modelcontextprotocol.io" rel="noopener">MCP</a>{" "}
            endpoint, so any MCP-capable assistant — Claude, ChatGPT, or your own agent —
            can read and manage your watering program the same way the app does. It works the same
            way you'd connect Claude to any smart-home device, except irrigation is the one place
            an agent gets real agronomy to reason with: live weather, soil, grass type, and your
            local watering restrictions.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">1 · Get your connector URL</h2>
          <p className="text-pine/70">
            Sign in, open the <Link href="/dashboard" className="underline underline-offset-2">dashboard</Link>,
            find <b>Connect your AI agent</b>, and press <b>Generate agent key</b>. The URL shown
            contains your key and is displayed once — treat it like a password. Re-generating or
            revoking from the same panel cuts off any previously connected agent immediately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">2 · Add it to your assistant</h2>
          <div className="rounded-xl bg-cloud border border-pine/5 px-5 py-4 space-y-2 text-pine/75 text-[15px]">
            <p><b>Claude</b> (web or desktop): Settings → Connectors → <i>Add custom connector</i> → paste the URL.</p>
            <p><b>ChatGPT</b>: Settings → Connectors → <i>Add MCP server</i> → paste the URL.</p>
            <p><b>Claude Code / other MCP clients</b>: add it as a streamable-HTTP server URL.</p>
          </div>
          <p className="text-sm text-pine/55">
            The endpoint is stateless streamable-HTTP (POST JSON-RPC) with the key in the URL path —
            no OAuth dance required. Scoped OAuth 2.1 authorization is on the roadmap.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">3 · Talk to your lawn</h2>
          <div className="rounded-xl bg-cloud border border-pine/5 px-5 py-4 text-pine/75 text-[15px] space-y-1">
            <p>&ldquo;What&apos;s my watering plan today, and why?&rdquo;</p>
            <p>&ldquo;We just laid new sod in the back — set that zone's planting date to today.&rdquo;</p>
            <p>&ldquo;It's pouring here — pause watering.&rdquo;</p>
            <p>&ldquo;Did anything actually run this week?&rdquo;</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">Available tools</h2>
          <div className="overflow-x-auto rounded-xl border border-pine/5">
            <table className="w-full text-sm">
              <tbody>
                {TOOL_LIST.map(([name, blurb]) => (
                  <tr key={name} className="border-b border-pine/5 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-pine whitespace-nowrap">{name}</td>
                    <td className="px-4 py-2 text-pine/65">{blurb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-pine/55">
            Every change is validated by the same engine the app uses, and the hard safety gates
            (legal watering windows, live weather checks) are enforced server-side — an agent can
            adjust the program, never bypass the guardrails.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">Privacy: what your agent can and can&apos;t see</h2>
          <div className="rounded-xl bg-cloud border border-pine/5 px-5 py-4 text-pine/75 text-[15px] space-y-2">
            <p>
              Connecting an agent shares and stores <b>no new private data</b>. Your assistant can
              read exactly what your dashboard shows — this account&apos;s lawn profile, schedule,
              run history, and public weather — and nothing else.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>It <b>cannot</b> see your B-hyve credentials (Verdyn never stores your password), your email, or any other account.</li>
              <li>Verdyn <b>never sees your conversations</b> — the endpoint receives individual tool calls, and we store no prompts or transcripts, only the key&apos;s last-used timestamp.</li>
              <li>Nothing is pushed to any AI provider — your assistant pulls from your endpoint only when you ask, and nothing is used for model training.</li>
              <li>Only the key&apos;s SHA-256 hash is stored; revoking it in the dashboard cuts off any connected agent instantly.</li>
            </ul>
            <p className="text-sm text-pine/55">
              Full details in the <Link href="/privacy#agents" className="underline underline-offset-2">privacy policy</Link>.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
