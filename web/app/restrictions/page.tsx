// Watering-restrictions directory — the geo-neutral front door ("watering
// restrictions by zip code", "can I water my lawn today") linking to one page
// per water authority. Each locality page doubles as documentation for the
// compliance rules the scheduling engine enforces.
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { METROS } from "@/lib/restrictions-content";

export const metadata = {
  title: "Watering Restrictions by City — Can I Water My Lawn Today? — Verdyn",
  description:
    "Current lawn watering restrictions by city and ZIP: allowed days, odd/even address rules, time-of-day windows, and new-sod exemptions — and how Verdyn schedules around them automatically.",
};

export default function RestrictionsIndex() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/"><Logo size={26} /></Link>
          <Link href="/onboarding" className="text-sm font-medium text-pine/60 hover:text-pine">Get started</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14 space-y-10">
        <div>
          <h1 className="text-3xl font-extrabold text-pine">Lawn watering restrictions, by city</h1>
          <p className="mt-3 text-pine/70">
            Most U.S. cities limit when you can run sprinklers — assigned days by
            address, odd/even schedules, and no-watering hours in the heat of the
            day. The rules change by season and by drought stage, which is why
            &ldquo;can I water my lawn today?&rdquo; is genuinely hard to answer.
            Verdyn builds these rules into your watering schedule automatically;
            the pages below document what each authority currently requires.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">Restrictions by metro</h2>
          <div className="overflow-x-auto rounded-xl border border-pine/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cloud text-left text-pine/60">
                  <th className="px-4 py-2 font-semibold">City</th>
                  <th className="px-4 py-2 font-semibold">Watering days</th>
                  <th className="px-4 py-2 font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody>
                {METROS.map((m) => (
                  <tr key={m.slug} className="border-t border-pine/5">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/restrictions/${m.slug}`} className="font-medium text-pine underline underline-offset-2 hover:text-green">
                        {m.city}, {m.state}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-pine/65">{m.days}</td>
                    <td className="px-4 py-2 text-pine/65">{m.timeWindows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-pine/55">
            Somewhere else? Verdyn resolves your local rules from your ZIP during{" "}
            <Link href="/onboarding" className="underline underline-offset-2">onboarding</Link> — this
            directory is just the most-searched metros, and it grows.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-pine">How the common schemes work</h2>
          <div className="space-y-3 text-pine/70">
            <p>
              <b>Assigned days</b>: your allowed day(s) come from your address — usually the last
              digit of your house number or a published map. Watering outside your days is citable
              even if your lawn is dry.
            </p>
            <p>
              <b>Odd/even</b>: odd-numbered addresses water on one set of days, even on another.
              Simple, but the day sets often shift between daylight-saving and standard time.
            </p>
            <p>
              <b>Time-of-day windows</b>: nearly every authority bans watering in the middle of the
              day (commonly 10&nbsp;a.m.–4&nbsp;p.m. or wider in summer) because evaporation wastes
              much of what you apply.
            </p>
            <p>
              <b>New lawn exemptions</b>: fresh sod or seed usually qualifies for a 30–90 day
              establishment exception, sometimes requiring a permit. If you just installed turf,
              check your city&apos;s page — daily watering is often legal when it would otherwise
              be a violation.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-pine text-mist px-6 py-6 space-y-2">
          <h2 className="text-lg font-bold">Verdyn follows the rules for you</h2>
          <p className="text-mist/80 text-[15px]">
            Tell Verdyn your ZIP and address parity once. Every schedule it builds respects your
            allowed days and hours, applies new-turf establishment programs when you set a planting
            date, and still skips for rain — restriction-legal and weather-smart at the same time.
          </p>
          <Link href="/onboarding" className="inline-block mt-1 rounded-lg bg-sprout text-pine font-semibold text-sm px-4 py-2 hover:opacity-90 transition">
            Set up your lawn →
          </Link>
        </section>

        <p className="text-xs text-pine/45">
          Rules summarized from each authority&apos;s official published schedule and reviewed
          August 2026. Restrictions change with drought conditions — always confirm with your
          utility before relying on them; the official source is linked on every page.
        </p>
      </article>
    </main>
  );
}
