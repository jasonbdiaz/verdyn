import Link from "next/link";
import { Logo } from "@/components/Logo";

const REPO = "https://github.com/jasonbdiaz/verdyn";

/**
 * Informational "coming soon" screen for the hosted flows (onboarding, pricing)
 * while the payment portal is being stood up. No sign-up, no state — it points
 * people to the two things that ARE available today: the open-source repo (self-
 * host everything) and the docs. Plain component (no hooks) so it can be rendered
 * from both client and server route files.
 */
export default function ComingSoon({
  title = "Hosted Verdyn is coming soon",
  blurb = "We're putting the finishing touches on hosted accounts. In the meantime, the entire product is open source — you can run all of it yourself today.",
}: {
  title?: string;
  blurb?: string;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-pine/5">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-7 text-sm font-medium">
            <Link href="/" className="hover:text-green transition">Home</Link>
            <Link href="/faq" className="hidden sm:inline hover:text-green transition">FAQ</Link>
            <Link href="/privacy" className="hidden sm:inline hover:text-green transition">Privacy</Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 mx-auto max-w-3xl px-6 py-24 text-center flex flex-col items-center justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-green/10 text-green px-4 py-1.5 text-sm font-semibold mb-6">
          Coming soon
        </span>
        <h1 className="display text-4xl sm:text-5xl font-bold leading-[1.08]">
          <span className="brand-gradient-text">{title}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pine/70">{blurb}</p>

        <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
          <a
            href={REPO}
            className="rounded-full px-7 py-3.5 text-cloud font-semibold brand-gradient shadow-lg shadow-green/20 hover:opacity-90 transition"
          >
            Run it yourself — open source →
          </a>
          <Link
            href="/docs/self-host"
            className="rounded-full px-7 py-3.5 font-semibold text-pine border border-pine/15 hover:border-green/40 hover:text-green transition"
          >
            Self-host guide
          </Link>
        </div>

        <p className="mt-8 text-sm text-pine/55">
          Want a nudge when hosted accounts open?{" "}
          <a href="mailto:hello@verdyn.app?subject=Notify%20me%20when%20Verdyn%20launches" className="text-green font-semibold hover:underline">
            Email us
          </a>{" "}
          and we&rsquo;ll let you know.
        </p>
      </section>

      <footer className="border-t border-pine/10">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-pine/55">
          <Logo size={22} />
          <nav className="flex items-center gap-6 font-medium">
            <Link href="/faq" className="hover:text-green transition">FAQ</Link>
            <Link href="/privacy" className="hover:text-green transition">Privacy</Link>
            <Link href="/terms" className="hover:text-green transition">Terms</Link>
            <a href={REPO} className="hover:text-green transition">GitHub</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
