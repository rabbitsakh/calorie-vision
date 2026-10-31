import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

/** Public crawl rules — private app chrome stays out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/dev/", "/auth/"],
      },
    ],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: new URL(absoluteSiteUrl("/")).host,
  };
}
