import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@verdyn/core";
import { Logo } from "@/components/Logo";
import { FAQS, FAQ_CATEGORIES, faqJsonLd } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Verdyn FAQ — B-hyve compatibility, zones, privacy & cancellation",
  description:
    "Answers about Verdyn: which Orbit B-hyve devices it controls, the maximum number of sprinkler zones (up to 16 per controller, more across controllers), brand compatibility, how scheduling works, cancellation, and data privacy.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = faqJsonLd();

  return (
    <main className="min-h-screen">
      {/* AI/answer-engine structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="sticky top-0 z-20 backdrop-blur bg-mist/80 border-b border-pine/5">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <Link href="/"><Logo /></Link>
          <Link
            href="/onboarding"
            className="rounded-full px-5 py-2 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition"
          >
            Get started
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm font-semibold text-green">Help center</p>
        <h1 className="mt-1 display text-4xl sm:text-5xl font-bold">Frequently asked questions</h1>
        <p className="mt-4 text-lg text-pine/65">
          Everything about connecting your B-hyve®, what Verdyn controls, and how
          your data and subscription are handled.
        </p>

        {/* quick category jump */}
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="FAQ categories">
          {FAQ_CATEGORIES.map((c) => (
            <a
              key={c}
              href={`#${slug(c)}`}
              className="rounded-full border border-pine/10 bg-cloud px-4 py-1.5 text-sm font-medium text-pine/70 hover:border-green/40 hover:text-green transition"
            >
              {c}
            </a>
          ))}
        </nav>

        {/* grouped Q&A — semantic <article> per question for clean extraction */}
        <div className="mt-10 space-y-12">
          {FAQ_CATEGORIES.map((cat) => {
            const items = FAQS.filter((f) => f.category === cat);
            if (!items.length) return null;
            return (
              <section key={cat} id={slug(cat)} aria-labelledby={`${slug(cat)}-h`} className="scroll-mt-24">
                <h2 id={`${slug(cat)}-h`} className="text-sm font-bold uppercase tracking-wider text-green">
                  {cat}
                </h2>
                <div className="mt-4 divide-y divide-pine/5 rounded-2xl bg-cloud border border-pine/5">
                  {items.map((f) => (
                    <article key={f.q} className="p-6" itemScope itemType="https://schema.org/Question">
                      <h3 className="text-lg font-semibold" itemProp="name">{f.q}</h3>
                      <div
                        className="mt-2 text-pine/70 leading-relaxed"
                        itemProp="acceptedAnswer"
                        itemScope
                        itemType="https://schema.org/Answer"
                      >
                        <p itemProp="text">{f.a}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl brand-gradient p-8 text-center text-cloud">
          <h2 className="text-2xl font-bold">Still have a question?</h2>
          <p className="mt-2 text-cloud/85">The fastest way to see what Verdyn does is to connect your B-hyve.</p>
          <Link href="/onboarding" className="inline-block mt-5 rounded-full bg-cloud px-7 py-3 font-semibold text-green hover:opacity-90 transition">
            Get started free
          </Link>
        </div>

        <p className="mt-10 text-xs text-pine/45">{brand.legal}</p>
      </div>
    </main>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
