import type { MetadataRoute } from "next";

const SITE = "https://verdyn.app";

// Public, indexable marketing/legal routes only — app routes (dashboard, setup,
// login) and API endpoints are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const route = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    route("/", 1.0, "weekly"),
    route("/pricing", 0.9, "weekly"),
    route("/faq", 0.8, "monthly"),
    route("/pro", 0.7, "monthly"),
    route("/onboarding", 0.6, "monthly"),
    route("/privacy", 0.3, "yearly"),
    route("/terms", 0.3, "yearly"),
  ];
}
