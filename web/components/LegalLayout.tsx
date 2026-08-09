import Link from "next/link";
import { brand } from "@verdyn/core";
import { Logo } from "@/components/Logo";

// Shared chrome for /privacy and /terms — keeps the legal pages visually
// consistent with the rest of the site and DRYs the header/footer.
export function LegalLayout({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
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

      <article className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm font-semibold text-green">{eyebrow}</p>
        <h1 className="mt-1 display text-4xl sm:text-5xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-pine/45">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-pine/75 leading-relaxed">{children}</div>

        <div className="mt-14 flex flex-wrap gap-6 border-t border-pine/10 pt-8 text-sm font-medium text-pine/60">
          <Link href="/privacy" className="hover:text-green transition">Privacy</Link>
          <Link href="/terms" className="hover:text-green transition">Terms</Link>
          <Link href="/faq" className="hover:text-green transition">FAQ</Link>
          <Link href="/" className="hover:text-green transition">Home</Link>
        </div>
        <p className="mt-8 text-xs text-pine/45">{brand.legal}</p>
      </article>
    </main>
  );
}

// Small typographic helpers so each page reads like prose, not markup.
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-pine scroll-mt-24">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-green">{children}</ul>;
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <H2>{title}</H2>
      {children}
    </section>
  );
}
