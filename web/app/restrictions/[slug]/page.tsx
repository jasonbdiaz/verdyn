// Per-authority watering-restriction page ("watering restrictions in Austin",
// "Miami-Dade watering days"). Static at build time from lib/restrictions-content;
// each page links its official source and cross-links the rest of the directory.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { METROS } from "@/lib/restrictions-content";

export function generateStaticParams() {
  return METROS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = METROS.find((x) => x.slug === slug);
  if (!m) return {};
  return {
    title: `Watering Restrictions in ${m.city}, ${m.state} — Days, Hours & New-Sod Rules — Verdyn`,
    description: `${m.city} lawn watering rules (${m.authority}): ${m.days}. ${m.timeWindows}. New-lawn exemptions and how to stay compliant automatically.`,
  };
}

export default async function MetroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = METROS.find((x) => x.slug === slug);
  if (!m) notFound();

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What days can I water my lawn in ${m.city}?`,
        acceptedAnswer: { "@type": "Answer", text: `${m.days}. ${m.currentRules}` },
      },
      {
        "@type": "Question",
        name: `What hours can I run sprinklers in ${m.city}?`,
        acceptedAnswer: { "@type": "Answer", text: m.timeWindows },
      },
      {
        "@type": "Question",
        name: `Can I water new sod or seed daily in ${m.city}?`,
        acceptedAnswer: { "@type": "Answer", text: m.newLawnException },
      },
    ],
  };

  return (
    <main className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/"><Logo size={26} /></Link>
          <Link href="/restrictions" className="text-sm font-medium text-pine/60 hover:text-pine">All cities</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14 space-y-8">
        <div>
          <p className="text-sm font-medium text-green">
            <Link href="/restrictions" className="hover:underline">Watering restrictions</Link> · {m.state}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-pine">
            Watering restrictions in {m.city}, {m.state}
          </h1>
          <p className="mt-2 text-sm text-pine/55">
            Authority: <b>{m.authority}</b> · Schedule type: {m.scheduleType} · Reviewed {m.asOf}
          </p>
        </div>

        <section className="rounded-xl bg-cloud border border-pine/5 px-5 py-4 space-y-2">
          <h2 className="text-lg font-bold text-pine">The current rules</h2>
          <p className="text-pine/75 text-[15px]">{m.currentRules}</p>
          <div className="grid sm:grid-cols-2 gap-3 pt-2 text-sm">
            <div className="rounded-lg bg-mist px-4 py-3">
              <div className="font-semibold text-pine">Watering days</div>
              <div className="text-pine/65 mt-0.5">{m.days}</div>
            </div>
            <div className="rounded-lg bg-mist px-4 py-3">
              <div className="font-semibold text-pine">Hours</div>
              <div className="text-pine/65 mt-0.5">{m.timeWindows}</div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-pine">New sod or seed?</h2>
          <p className="text-pine/70">{m.newLawnException}</p>
        </section>

        {m.seasonal ? (
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-pine">Seasonal changes</h2>
            <p className="text-pine/70">{m.seasonal}</p>
          </section>
        ) : null}

        {m.enforcement ? (
          <section className="space-y-2">
            <h2 className="text-xl font-bold text-pine">Enforcement</h2>
            <p className="text-pine/70">{m.enforcement}</p>
          </section>
        ) : null}

        <section className="rounded-2xl bg-pine text-mist px-6 py-6 space-y-2">
          <h2 className="text-lg font-bold">Never think about this again</h2>
          <p className="text-mist/80 text-[15px]">
            Verdyn builds {m.city}&apos;s allowed days and hours into every schedule it creates,
            layers live weather on top, and applies the new-turf establishment program when you
            set a planting date. Compliant and agronomically right, automatically.
          </p>
          <Link href="/onboarding" className="inline-block mt-1 rounded-lg bg-sprout text-pine font-semibold text-sm px-4 py-2 hover:opacity-90 transition">
            Set up your lawn →
          </Link>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-pine/60">Other cities</h2>
          <p className="text-sm text-pine/60 leading-relaxed">
            {METROS.filter((x) => x.slug !== m.slug).map((x, i, arr) => (
              <span key={x.slug}>
                <Link href={`/restrictions/${x.slug}`} className="underline underline-offset-2 hover:text-green">
                  {x.city}, {x.state}
                </Link>
                {i < arr.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </section>

        <p className="text-xs text-pine/45">
          Summarized from the official schedule published by {m.authority} (
          <a href={m.sourceUrl} rel="noopener nofollow" className="underline underline-offset-2">source</a>
          ), reviewed {m.asOf}. Restrictions change with drought stages and seasons — confirm with
          the authority before relying on this page.
        </p>
      </article>
    </main>
  );
}
