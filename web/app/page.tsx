import Link from "next/link";
import Image from "next/image";
import { brand, GRASS_TYPES, RESTRICTION_POLICIES, CONTROLLER_CATALOG } from "@verdyn/core";
import { Logo, LogoMark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SavingsCalculator } from "@/components/SavingsCalculator";
import { ControllerWaitlist } from "@/components/ControllerWaitlist";
import heroSprinkler from "@/public/hero-sprinkler.jpg";

const liveCount = CONTROLLER_CATALOG.filter((b) => b.status === "live").length;
const soonCount = CONTROLLER_CATALOG.filter((b) => b.status === "coming_soon").length;

const features = [
  {
    title: "Cycle-and-soak, automatically",
    body: "Verdyn splits each run into soak passes matched to your soil's infiltration rate — so water reaches the roots instead of running down the driveway.",
    icon: "💧",
  },
  {
    title: "Seasonal ET scheduling",
    body: "Runtimes scale with your local evapotranspiration month to month. More in July, less in February — no manual seasonal adjust dials.",
    icon: "🌡️",
  },
  {
    title: "Weather-aware skips",
    body: "Rain yesterday, rain coming, or 20+ mph wind? Verdyn skips or trims the run before your controller wastes a drop.",
    icon: "🌧️",
  },
  {
    title: "Local watering rules, handled",
    body: "Verdyn knows your city's restriction days and daytime bans from your ZIP — and honors the new-sod establishment exemption automatically.",
    icon: "📋",
  },
  {
    title: "Expert mode",
    body: "Dial in head type, precip rate, sun, and slope per zone for catch-cup-grade precision. Or keep it simple — your call.",
    icon: "🎛️",
  },
  {
    title: "Runs on your B-hyve",
    body: "No new hardware. Connect the controller you already own and Verdyn writes the smart schedule straight to it.",
    icon: "🔌",
  },
];

const steps = [
  { n: 1, t: "Connect your B-hyve", d: "Sign in with your Orbit® account. We read your zones securely." },
  { n: 2, t: "Tell us about your lawn", d: "ZIP, soil, grass type, and whether it's newly sodded. Two minutes." },
  { n: 3, t: "Verdyn waters like a pro", d: "A daily plan built from agronomy, weather, and your local rules — on autopilot." },
];

const TIERS: {
  name: string; price: string; body: string; points: string[]; featured?: boolean;
}[] = [
  {
    name: "Open source",
    price: "clone it · free forever",
    body: "The whole engine is public. Self-host it and own every byte.",
    points: [
      "Full agronomy engine + automated executor",
      "Runs with or without a database",
      "Your credentials never leave your servers",
    ],
  },
  {
    name: "Expert · Agentic",
    price: "free hosted account",
    body: "Sign up, connect your controller, and drive it from Claude or ChatGPT over MCP.",
    points: [
      "Personal MCP endpoint for your AI agent",
      "Hosted automation: cron executor, weather gates, run ledger",
      "Safety windows enforced server-side — always",
    ],
    featured: true,
  },
  {
    name: "Managed",
    price: "we do everything",
    body: "For people who'd rather never think about irrigation — or AI.",
    points: [
      "White-glove setup, zones tuned to your yard",
      "One-time Orbit sign-in — your password is never stored",
      "A human keeps it dialed season over season",
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <ScrollProgress />

      {/* nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-mist/80 border-b border-pine/5">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-7 text-sm font-medium">
            <a href="#how" className="hidden sm:inline hover:text-green transition">How it works</a>
            <Link href="/pricing" className="hidden sm:inline hover:text-green transition">Pricing</Link>
            <Link href="/faq" className="hidden sm:inline hover:text-green transition">FAQ</Link>
            <Link
              href="/onboarding"
              className="rounded-full px-5 py-2 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-green/10 text-green px-4 py-1.5 text-sm font-semibold mb-6">
              <LogoMark size={18} /> For B-hyve® owners
            </span>
            <h1 className="display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05]">
              <span className="brand-gradient-text">Water like a pro.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg sm:text-xl text-pine/70 mx-auto lg:mx-0">
              {brand.oneLiner} Verdyn turns the controller you already own into a
              smart, agronomy-driven irrigation system — soil, season, weather, and
              local rules, all handled for you. <span className="font-semibold text-pine">Free, forever.</span>
            </p>
            <div className="mt-9 flex items-center justify-center lg:justify-start gap-3">
              <Link
                href="/onboarding"
                className="rounded-full px-7 py-3.5 text-cloud font-semibold brand-gradient shadow-lg shadow-green/20 hover:opacity-90 transition"
              >
                Make my B-hyve smarter
              </Link>
              <a
                href="#how"
                className="rounded-full px-7 py-3.5 font-semibold text-pine border border-pine/15 hover:border-green/40 hover:text-green transition"
              >
                See how
              </a>
            </div>
            <p className="mt-4 text-sm text-pine/50">Free forever · No new hardware · 2-minute setup · No card required</p>
          </div>

          {/* hero photo */}
          <Reveal className="relative" delay={120}>
            <div className="relative mx-auto max-w-lg overflow-hidden rounded-3xl shadow-2xl shadow-green/20 ring-1 ring-pine/10">
              <Image
                src={heroSprinkler}
                alt="A pop-up sprinkler watering a lush green lawn in golden-hour light"
                placeholder="blur"
                priority
                sizes="(max-width: 1024px) 90vw, 40vw"
                className="h-full w-full object-cover"
              />
              {/* subtle brand wash for cohesion */}
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-pine/10 via-transparent to-sprout/10" />
            </div>
          </Reveal>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[44rem] rounded-full opacity-20 blur-3xl brand-gradient animate-float"
        />
      </section>

      {/* how it works */}
      <section id="how" className="bg-cloud border-y border-pine/5">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal as="h2" className="text-3xl sm:text-4xl font-bold text-center">From owner to pro in 3 steps</Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="relative rounded-2xl bg-mist p-7 h-full">
                  <div className="display text-5xl font-bold brand-gradient-text">{s.n}</div>
                  <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                  <p className="mt-2 text-pine/65">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal as="h2" className="text-3xl sm:text-4xl font-bold text-center">The intelligence layer your controller is missing</Reveal>
        <Reveal as="p" delay={80} className="mt-3 text-center text-pine/65 max-w-2xl mx-auto">
          B-hyve runs the valves. Verdyn decides — every day — exactly how much to
          water each zone, and when to hold back.
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 100}>
              <div className="rounded-2xl bg-cloud p-7 border border-pine/5 hover:border-green/30 hover:-translate-y-1 transition-all duration-300 h-full">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-pine/65 text-[15px] leading-relaxed">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* comparison — positioning */}
      <section id="compare" className="bg-cloud border-y border-pine/5">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Reveal as="h2" className="text-3xl sm:text-4xl font-bold text-center">
            Why not just the app it came with?
          </Reveal>
          <Reveal as="p" delay={80} className="mt-3 text-center text-pine/65 max-w-2xl mx-auto">
            A timer follows a clock. The B-hyve app follows your settings. Verdyn
            follows agronomy — soil, season, weather, and the rules where you live.
          </Reveal>
          <Reveal delay={140} className="mt-12">
            <CompareTable />
          </Reveal>
        </div>
      </section>

      {/* works with your controller */}
      <section id="works-with" className="bg-cloud border-y border-pine/5">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal as="h2" className="text-3xl sm:text-4xl font-bold text-center">Works with your controller</Reveal>
          <Reveal as="p" delay={80} className="mt-3 text-center text-pine/65 max-w-2xl mx-auto">
            B-hyve is live today. Rain Bird, Rachio, Hunter, Govee, Moen &amp; more —
            plus WiFi hose-bib timers — are on the way. Pick yours below and
            we&apos;ll email you the moment it&apos;s ready.
          </Reveal>
          <Reveal delay={140} className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-mist px-5 py-2 text-sm font-medium text-pine/70 border border-pine/5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green" /> {liveCount} live now
              </span>
              <span className="text-pine/20">·</span>
              <span>{soonCount} on the roadmap</span>
            </div>
          </Reveal>

          <ControllerWaitlist />
        </div>
      </section>

      {/* savings — interactive proof of value */}
      <section id="savings" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal as="h2" className="text-3xl sm:text-4xl font-bold text-center">
          Up to 45% less water. Zero effort.
        </Reveal>
        <Reveal as="p" delay={80} className="mt-3 text-center text-pine/65 max-w-2xl mx-auto">
          Smart, ET-based watering routinely cuts outdoor use 30–50% versus a fixed
          timer — without a browner lawn. Move the slider and see your number.
        </Reveal>
        <Reveal delay={140} className="mt-12 max-w-4xl mx-auto">
          <SavingsCalculator />
        </Reveal>
      </section>

      {/* proof strip */}
      <section className="bg-pine text-mist">
        <div className="mx-auto max-w-6xl px-6 py-16 grid gap-8 sm:grid-cols-3 text-center">
          <Reveal><Stat n={`${GRASS_TYPES.length}`} l="grass types modeled" /></Reveal>
          <Reveal delay={120}><Stat n={`${Object.keys(RESTRICTION_POLICIES).length}`} l="regional rule sets built in" /></Reveal>
          <Reveal delay={240}><Stat n="up to 16" l="zones per controller" /></Reveal>
        </div>
      </section>

      {/* origin story — credibility */}
      <section id="origin" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-green/10 text-green px-4 py-1.5 text-sm font-semibold">
              <LogoMark size={16} /> Built on a working system
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-bold leading-tight">
              Born on a real golf green.
            </h2>
            <p className="mt-5 text-lg text-pine/70 leading-relaxed">
              Verdyn&apos;s engine didn&apos;t start in a slide deck. It&apos;s the same
              agronomy-driven scheduler that waters a private Bermuda putting green every
              morning — cycle-and-soak tuned to soil infiltration, runtimes that track
              local evapotranspiration, and hard safety rules that refuse to water in the
              heat of the day or into a coming storm.
            </p>
            <p className="mt-4 text-lg text-pine/70 leading-relaxed">
              We took the system that keeps a green tournament-tight and made it work for
              any lawn — no superintendent required.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid grid-cols-2 gap-4">
              <OriginStat n="365" l="mornings a year, on autopilot" />
              <OriginStat n="0" l="schedules to babysit" />
              <OriginStat n="Dawn" l="default watering window — and your local rules, honored" />
              <OriginStat n="< 2 min" l="from owner to running" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* tiers — the model, made legible */}
      <section id="plans" className="bg-cloud border-y border-pine/5">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal as="h2" className="text-3xl sm:text-4xl font-bold text-center">
            Free where it matters. Effortless when you want it.
          </Reveal>
          <Reveal as="p" delay={80} className="mt-3 text-center text-pine/65 max-w-2xl mx-auto">
            The smart engine is free for every homeowner — for good. Upgrade only when
            you want Verdyn to run the whole yard for you, or to manage it as a business.
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TIERS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className={`flex h-full flex-col rounded-2xl p-7 border ${
                  t.featured ? "border-green ring-1 ring-green bg-mist shadow-xl shadow-green/10" : "border-pine/5 bg-mist"
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{t.name}</h3>
                    <span className="text-sm font-semibold text-green">{t.price}</span>
                  </div>
                  <p className="mt-2 text-[15px] text-pine/65 leading-relaxed">{t.body}</p>
                  <ul className="mt-4 space-y-2 text-[15px] text-pine/75">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2"><span className="text-green font-bold">✓</span><span>{p}</span></li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={320} className="mt-10 text-center">
            <Link href="/pricing" className="text-sm font-semibold text-green hover:underline">
              Compare plans in full →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Reveal as="h2" className="text-3xl sm:text-5xl font-bold">Your grass is thirsty for smarter.</Reveal>
        <Reveal as="p" delay={80} className="mt-4 text-lg text-pine/70">
          Connect your B-hyve and let Verdyn build your first plan in minutes — free.
        </Reveal>
        <Reveal delay={160}>
          <Link
            href="/onboarding"
            className="inline-block mt-8 rounded-full px-8 py-4 text-cloud font-semibold brand-gradient shadow-lg shadow-green/20 hover:opacity-90 transition"
          >
            Start free — make my B-hyve smarter
          </Link>
        </Reveal>
        <Reveal as="p" delay={220} className="mt-4 text-sm text-pine/50">
          Open source · No card, ever · Your controller stays yours
        </Reveal>
      </section>

      {/* footer */}
      <footer className="border-t border-pine/10 bg-cloud">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={24} />
          <nav className="flex items-center gap-6 text-sm font-medium text-pine/60">
            <Link href="/pricing" className="hover:text-green transition">Pricing</Link>
            <Link href="/faq" className="hover:text-green transition">FAQ</Link>
            <Link href="/privacy" className="hover:text-green transition">Privacy</Link>
            <Link href="/terms" className="hover:text-green transition">Terms</Link>
            <Link href="/onboarding" className="hover:text-green transition">Get started</Link>
          </nav>
          <p className="text-xs text-pine/45 max-w-md text-center sm:text-right">
            {brand.legal}
          </p>
        </div>
      </footer>
    </main>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="display text-4xl sm:text-5xl font-bold text-sprout">{n}</div>
      <div className="mt-1 text-mist/70">{l}</div>
    </div>
  );
}

function OriginStat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl bg-cloud p-6 border border-pine/5 text-center">
      <div className="display text-3xl sm:text-4xl font-bold brand-gradient-text">{n}</div>
      <div className="mt-1.5 text-sm text-pine/60">{l}</div>
    </div>
  );
}

// Honest positioning vs. the two things a B-hyve owner already has.
const COMPARE_ROWS: { feat: string; timer: boolean; app: boolean; verdyn: boolean }[] = [
  { feat: "Turns water on and off on a schedule", timer: true, app: true, verdyn: true },
  { feat: "Control from your phone", timer: false, app: true, verdyn: true },
  { feat: "Runtimes auto-scale to the season (ET)", timer: false, app: false, verdyn: true },
  { feat: "Cycle-and-soak matched to your soil", timer: false, app: false, verdyn: true },
  { feat: "Skips for rain, forecast & high wind", timer: false, app: false, verdyn: true },
  { feat: "Knows your city's watering-day rules", timer: false, app: false, verdyn: true },
  { feat: "Per-zone agronomy (grass, sun, slope)", timer: false, app: false, verdyn: true },
  { feat: "Decides for you — nothing to babysit", timer: false, app: false, verdyn: true },
];

function CompareTable() {
  return (
    <div className="overflow-hidden rounded-3xl border border-pine/10 bg-mist">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-pine/10">
            <th className="p-4 sm:p-5 text-sm font-semibold text-pine/60 w-1/2">What you get</th>
            <th className="p-3 sm:p-5 text-center text-sm font-semibold text-pine/50">Old timer</th>
            <th className="p-3 sm:p-5 text-center text-sm font-semibold text-pine/50">B-hyve app</th>
            <th className="p-3 sm:p-5 text-center text-sm font-semibold">
              <span className="brand-gradient-text">Verdyn</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((r, i) => (
            <tr key={r.feat} className={i % 2 ? "bg-cloud/50" : ""}>
              <td className="p-4 sm:p-5 text-[15px] text-pine/80">{r.feat}</td>
              <CompareCell on={r.timer} />
              <CompareCell on={r.app} />
              <CompareCell on={r.verdyn} highlight />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareCell({ on, highlight }: { on: boolean; highlight?: boolean }) {
  return (
    <td className={`p-3 sm:p-5 text-center ${highlight ? "bg-green/5" : ""}`}>
      {on ? (
        <span
          aria-label="Yes"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
            highlight ? "bg-green text-cloud" : "bg-pine/10 text-pine/60"
          }`}
        >
          ✓
        </span>
      ) : (
        <span aria-label="No" className="text-pine/20 text-lg">
          —
        </span>
      )}
    </td>
  );
}
