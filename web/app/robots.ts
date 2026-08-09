import type { MetadataRoute } from "next";

const SITE = "https://verdyn.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated app surfaces and APIs out of the index.
      disallow: ["/api/", "/dashboard", "/setup", "/login"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
