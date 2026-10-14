import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL, publicPages, publicPostWhere } from "@/lib/seo";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.DEMO_MODE === "true") return [];
  const posts = await db().post.findMany({
    where: publicPostWhere,
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
  // shortcut: one sitemap suits this community; split before reaching 50,000 URLs.
  return [
    ...Object.keys(publicPages).map((path) => ({ url: SITE_URL + path })),
    ...posts.map((post) => ({
      url: SITE_URL + "/post/" + encodeURIComponent(post.id),
      lastModified: post.updatedAt,
    })),
  ];
}
