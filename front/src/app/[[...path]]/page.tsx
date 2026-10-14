import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { VillageApp } from "@/components/village-app";
import { getBootstrap } from "@/lib/bootstrap";
import { getPosts } from "@/lib/queries";
import {
  isPublicPost,
  pageMetadata,
  pageStructuredData,
  serializeJsonLd,
  validPagePath,
} from "@/lib/seo";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ path?: string[] }> };

const resolvePage = cache(async (pathname: string) => {
  const path = pathname.split("/").filter(Boolean);
  if (!validPagePath(path)) notFound();
  if (pathname === "/home") permanentRedirect("/");
  if (pathname === "/feed/all") permanentRedirect("/feed");
  const [section = "home", id] = path;
  const data = await getBootstrap();
  if ((section === "post" || section === "map") && id) {
    const post =
      data.mode === "demo"
        ? data.posts.find((p) => p.id === id)
        : (await getPosts(data.user?.id, undefined, { id }, 1, true)).posts[0];
    // Demo-only posts created in the browser have no server-side record.
    if (
      (!post && data.mode !== "demo") ||
      (post &&
        !isPublicPost(post) &&
        post.authorId !== data.user?.id &&
        data.user?.permission !== 0)
    )
      notFound();
    return { post, category: undefined, feed: undefined };
  }
  const category = section === "feed" ? (id ?? "all") : undefined;
  const feed =
    category && category !== "all" && data.mode === "live"
      ? await getPosts(data.user?.id, undefined, {
          category: category.toUpperCase() as Category,
        })
      : undefined;
  return { post: undefined, category, feed };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pathname = "/" + ((await params).path ?? []).join("/");
  const { post } = await resolvePage(pathname);
  return pageMetadata(pathname, post);
}

export default async function Page({ params }: Props) {
  const pathname = "/" + ((await params).path ?? []).join("/");
  const { post, feed, category } = await resolvePage(pathname);
  const structuredData = pageStructuredData(pathname, post);
  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />
      )}
      <VillageApp
        initialPost={post}
        initialFeed={feed}
        initialCategory={category}
      />
    </>
  );
}
