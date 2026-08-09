import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://verdyn.app";
const TITLE = "Verdyn — Water like a pro.";
const DESCRIPTION =
  "Pro-grade irrigation intelligence for any B-hyve. Verdyn turns your existing controller into a smart, agronomy-driven watering system that cuts outdoor water use up to 45%.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Verdyn",
  },
  description: DESCRIPTION,
  applicationName: "Verdyn",
  keywords: [
    "smart irrigation",
    "B-hyve",
    "Orbit B-hyve",
    "sprinkler controller",
    "lawn watering schedule",
    "ET-based irrigation",
    "evapotranspiration",
    "water savings",
    "smart sprinkler",
    "irrigation automation",
  ],
  authors: [{ name: "Verdyn" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Verdyn",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Verdyn",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web, iOS",
  url: SITE_URL,
  description: DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free forever — make any B-hyve smarter, no credit card required.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E7C5A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
