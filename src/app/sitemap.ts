import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

/** Marketing / legal URLs only (trailingSlash: true). */
const PUBLIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/try/", changeFrequency: "monthly", priority: 0.9 },
  { path: "/install/", changeFrequency: "monthly", priority: 0.85 },
  { path: "/welcome/", changeFrequency: "monthly", priority: 0.7 },
  { path: "/login/", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy/", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms/", changeFrequency: "yearly", priority: 0.4 },
  { path: "/disclaimer/", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: absoluteSiteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
