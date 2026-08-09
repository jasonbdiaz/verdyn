// Open-source tier — self-hosting guide.
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Self-host Verdyn — open source",
  description: "Run the full Verdyn irrigation engine yourself: clone, configure, deploy.",
};

const ENV_ROWS = [
  ["DATABASE_URL", "Postgres (Neon works great). Optional — the engine runs without it; persistence, auth and automation need it."],
  ["VERDYN_SESSION_SECRET", "32+ chars. Seals session cookies (AES-256-GCM)."],
  ["CRON_SECRET", "Bearer token protecting the /api/cron/run executor."],
  ["RESEND_API_KEY / EMAIL_FROM", "Optional — magic-link sign-in emails (console-logged without it)."],
  ["NEXT_PUBLIC_BASE_URL", "Public origin, used in agent-connector URLs."],
];

export default function SelfHostDocs() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/"><Logo size={26} /></Link>
          <a href="https://github.com/jasonbdiaz/verdyn" rel="noopener"
             className="text-sm font-medium text-pine/60 hover:text-pine">GitHub</a>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-pine">Self-host Verdyn</h1>
          <p className="mt-3 text-pine/70">
            Verdyn is open source. The whole product — the agronomy engine, the web app, the
            automated executor, and the MCP server — runs from one repo you control. Your
            controller credentials never touch anyone else&apos;s infrastructure.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">Quick start</h2>
          <pre className="overflow-x-auto rounded-xl bg-pine text-cloud text-sm px-5 py-4 leading-relaxed">{`git clone https://github.com/jasonbdiaz/verdyn
cd verdyn && npm install
cp web/.env.example web/.env.local   # fill in what you need
npm run dev -w @verdyn/web           # http://localhost:3000`}</pre>
          <p className="text-sm text-pine/55">
            No database? Everything still works in-browser with a local profile — persistence,
            accounts, unattended execution and the MCP endpoint activate when you add one.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">Environment</h2>
          <div className="overflow-x-auto rounded-xl border border-pine/5">
            <table className="w-full text-sm">
              <tbody>
                {ENV_ROWS.map(([k, v]) => (
                  <tr key={k} className="border-b border-pine/5 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-pine whitespace-nowrap">{k}</td>
                    <td className="px-4 py-2 text-pine/65">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-pine/55">
            Apply the schema with <code className="font-mono text-xs">DATABASE_URL=… node web/scripts/migrate.mjs</code>.
            For unattended watering, schedule <code className="font-mono text-xs">/api/cron/run</code> every
            15 minutes (Vercel crons, GitHub Actions, or any scheduler) with the CRON_SECRET bearer header.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">Safety model</h2>
          <p className="text-pine/70">
            The executor enforces defense-in-depth server-side: watering windows are hard-gated at
            the moment a valve would open, live weather is re-checked (wind + observed rain), every
            run is idempotently ledgered, and controller credentials are used once to mint a session
            token — never stored. Read <code className="font-mono text-xs">SECURITY.md</code> before
            pointing it at a real controller.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">The other tiers</h2>
          <p className="text-pine/70">
            Don&apos;t want to run servers? The hosted <Link href="/pricing" className="underline underline-offset-2">
            Expert tier</Link> is the same code with the ops handled — sign up, connect your
            controller, optionally wire your AI agent via <Link href="/docs/agent" className="underline underline-offset-2">MCP</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
