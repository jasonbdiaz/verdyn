import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Three ways to run Verdyn — open source, agentic, or managed",
  description:
    "Verdyn is open source. Self-host the whole engine free, sign up for the hosted Expert tier and drive it with your own AI agent over MCP, or have us run everything for you.",
  alternates: { canonical: "/pricing" },
};

const PATHS = [
  {
    badge: "Open source",
    title: "Clone it",
    tag: "free forever · your servers",
    blurb:
      "The entire product — agronomy engine, web app, unattended executor, MCP server — in one repo. Your controller credentials never leave your infrastructure.",
    bullets: [
      "Full engine: ET, cycle-and-soak, restriction compliance",
      "Runs with or without a database",
      "MIT-style licensed, PRs welcome",
    ],
    cta: { label: "View on GitHub →", href: "https://github.com/jasonbdiaz/verdyn", external: true },
    alt: { label: "Self-host guide", href: "/docs/self-host" },
  },
  {
    badge: "Expert · Agentic",
    title: "Bring your agent",
    tag: "free hosted account",
    blurb:
      "For people who already live in Claude or ChatGPT. Sign up, connect your controller, generate your personal MCP key — then manage your watering program by conversation, exactly like the developer runs his own yard.",
    bullets: [
      "Hosted + automated: cron executor, weather gates, run ledger",
      "Personal MCP endpoint — Claude, ChatGPT, any MCP client",
      "Every change validated; safety windows enforced server-side",
    ],
    cta: { label: "Sign up & connect →", href: "/onboarding" },
    alt: { label: "Agent setup guide", href: "/docs/agent" },
    featured: true,
  },
  {
    badge: "Managed",
    title: "We do everything",
    tag: "for the AI-uncurious",
    blurb:
      "Prefer to never think about it? We set up your zones, connect your Orbit account (one-time sign-in to mint the token — your password is never stored), tune the program to your yard, and keep it dialed season over season.",
    bullets: [
      "White-glove setup + ongoing tuning",
      "Same engine, same safety gates",
      "Direct line to a human when weather does weather things",
    ],
    cta: { label: "Request managed setup →", href: "mailto:hello@verdyn.app?subject=Managed%20Verdyn%20setup" },
    alt: { label: "What's included", href: "/faq" },
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-mist/80 border-b border-pine/5">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/"><Logo /></Link>
          <Link href="/onboarding" className="rounded-full px-5 py-2 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition">
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-sm font-semibold text-green">Three ways to run it</p>
        <h1 className="mt-1 display text-4xl sm:text-5xl font-bold">Open source at the core.<br />Pick your comfort level.</h1>
        <p className="mt-4 text-lg text-pine/65 max-w-2xl mx-auto">
          Verdyn is one codebase with three front doors: clone it and own everything,
          sign up and drive it with your AI agent, or let us run it for you.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 grid gap-6 md:grid-cols-3">
        {PATHS.map((p) => (
          <div key={p.title}
            className={`rounded-2xl border p-6 flex flex-col ${p.featured
              ? "border-green/30 bg-cloud shadow-lg shadow-green/5 ring-1 ring-green/20"
              : "border-pine/10 bg-cloud"}`}>
            <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${p.featured ? "brand-gradient text-cloud" : "bg-pine/5 text-pine/70"}`}>
              {p.badge}
            </span>
            <h2 className="mt-4 text-2xl font-bold text-pine">{p.title}</h2>
            <p className="text-sm font-medium text-green mt-0.5">{p.tag}</p>
            <p className="mt-3 text-[15px] text-pine/70">{p.blurb}</p>
            <ul className="mt-4 space-y-2 text-sm text-pine/75">
              {p.bullets.map((b) => (
                <li key={b} className="flex gap-2"><span aria-hidden className="text-green">✓</span>{b}</li>
              ))}
            </ul>
            <div className="mt-auto pt-6 flex flex-col gap-2">
              {p.cta.external ? (
                <a href={p.cta.href} rel="noopener"
                   className={`text-center rounded-full px-5 py-2.5 font-semibold transition ${p.featured ? "brand-gradient text-cloud hover:opacity-90" : "border border-pine/15 text-pine hover:border-green/40"}`}>
                  {p.cta.label}
                </a>
              ) : (
                <Link href={p.cta.href}
                   className={`text-center rounded-full px-5 py-2.5 font-semibold transition ${p.featured ? "brand-gradient text-cloud hover:opacity-90" : "border border-pine/15 text-pine hover:border-green/40"}`}>
                  {p.cta.label}
                </Link>
              )}
              <Link href={p.alt.href} className="text-center text-sm text-pine/55 hover:text-pine underline underline-offset-2">
                {p.alt.label}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center text-sm text-pine/55">
        <p>
          No subscriptions, no card forms, no trials. The hosted tiers run on the same public
          codebase — if we ever charge for managed service, it will be arranged like any other
          human agreement, not a checkout flow.
        </p>
      </section>
    </main>
  );
}
