import type { Metadata } from "next";
import { categories, type Post } from "./types";

export const SITE_URL = "https://apart.jujeop.com";
export const SITE_NAME = "햇빛마을20단지";
export const SITE_DESCRIPTION =
  "고양시 행신동 햇빛마을20단지의 먹거리, 요일장, 공고와 이웃의 현장 제보를 확인하세요.";
export const publicPostWhere = {
  hidden: false,
  adminDeleted: false,
  userDeleted: false,
};
export const publicPages = {
  "/about": {
    title: "생활정보 이용 안내와 자주 묻는 질문",
    description:
      "고양시 행신동 햇빛마을20단지의 먹거리·요일장 일정, 단지 공고, 현장 확인과 이웃 제보 이용 방법을 안내합니다.",
  },
  "/": {
    title: "햇빛마을20단지 생활정보 | 고양시 행신동",
    description: SITE_DESCRIPTION,
  },
  "/feed": {
    title: "생활 피드",
    description:
      "햇빛마을20단지의 먹거리, 요일장과 생활 공고를 모아 확인하세요.",
  },
  "/feed/food": {
    title: "먹거리 소식",
    description:
      "햇빛마을20단지 먹거리의 방문 일정과 이웃이 확인한 현장 제보입니다.",
  },
  "/feed/notice": {
    title: "단지 공고",
    description: "햇빛마을20단지의 생활 공고와 안내 사항을 확인하세요.",
  },
  "/feed/market": {
    title: "요일장 소식",
    description: "햇빛마을20단지 요일장의 예정 일정과 소식을 확인하세요.",
  },
  "/map": {
    title: "먹거리·요일장 지도",
    description:
      "햇빛마을20단지 주변 먹거리와 요일장 위치를 지도에서 확인하세요.",
  },
};

export function isPublicPost(
  post: Pick<Post, "hidden" | "adminDeleted" | "userDeleted">,
) {
  return !post.hidden && !post.adminDeleted && !post.userDeleted;
}

export function validPagePath(path: string[]) {
  if (!path.length) return true;
  const [section, id] = path;
  if (path.length > 2) return false;
  if (["home", "my", "report", "about"].includes(section))
    return path.length === 1;
  if (section === "feed")
    return (
      path.length === 1 || ["all", "food", "notice", "market"].includes(id)
    );
  if (section === "map") return path.length === 1 || !!id;
  return section === "post" && path.length === 2 && !!id;
}

export function pageMetadata(path: string, post?: Post | null): Metadata {
  const info = publicPages[path as keyof typeof publicPages];
  const index =
    process.env.DEMO_MODE !== "true" &&
    (!!info || (path.startsWith("/post/") && !!post && isPublicPost(post)));
  const title =
    post && isPublicPost(post)
      ? post.title
      : (info?.title ??
        (path === "/my"
          ? "내 정보"
          : path === "/report"
            ? "소식 제보"
            : "게시물"));
  const description =
    post && isPublicPost(post)
      ? post.body.replace(/\s+/g, " ").trim().slice(0, 160) || SITE_DESCRIPTION
      : (info?.description ?? SITE_DESCRIPTION);
  const image =
    post && isPublicPost(post)
      ? post.imageUrl || "/brand/share-banner.png"
      : "/brand/share-banner.png";
  const canonical = path.startsWith("/map/") ? "/map" : path;
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical: SITE_URL + canonical },
    robots: {
      index,
      follow: true,
      ...(index
        ? { "max-image-preview": "large" as const, "max-snippet": -1 }
        : {}),
    },
    openGraph: {
      ...(post && isPublicPost(post)
        ? {
            type: "article" as const,
            publishedTime: post.createdAt,
            modifiedTime: post.updatedAt ?? post.createdAt,
            authors: [post.author],
            section: categories[post.category],
          }
        : { type: "website" as const }),
      locale: "ko_KR",
      siteName: SITE_NAME,
      title,
      description,
      url: SITE_URL + canonical,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function pageBreadcrumbs(path: string, post?: Post | null) {
  const items = [{ name: SITE_NAME, path: "/" }];
  if (path === "/") return items;
  if (post && path.startsWith("/post/")) {
    items.push({ name: "생활 피드", path: "/feed" });
    const categoryPath = "/feed/" + post.category.toLowerCase();
    items.push({
      name: publicPages[categoryPath as keyof typeof publicPages].title,
      path: categoryPath,
    });
    items.push({ name: post.title, path });
  } else {
    const info = publicPages[path as keyof typeof publicPages];
    if (!info) return [];
    if (path.startsWith("/feed/"))
      items.push({ name: "생활 피드", path: "/feed" });
    items.push({ name: info.title, path });
  }
  return items;
}

export function pageStructuredData(path: string, post?: Post | null) {
  const info = publicPages[path as keyof typeof publicPages];
  if (
    process.env.DEMO_MODE === "true" ||
    (!info && !(path.startsWith("/post/") && post && isPublicPost(post)))
  )
    return null;
  const url = SITE_URL + path;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": SITE_URL + "/#website",
      url: SITE_URL + "/",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "ko-KR",
    },
    {
      "@type":
        path === "/about"
          ? "AboutPage"
          : path.startsWith("/feed")
            ? "CollectionPage"
            : "WebPage",
      "@id": url + "#webpage",
      url,
      name: post?.title ?? info?.title,
      description: post
        ? post.body.replace(/\s+/g, " ").trim().slice(0, 160)
        : info?.description,
      inLanguage: "ko-KR",
      isPartOf: { "@id": SITE_URL + "/#website" },
      ...(post ? { mainEntity: { "@id": url + "#post" } } : {}),
      ...(path !== "/" ? { breadcrumb: { "@id": url + "#breadcrumb" } } : {}),
    },
  ];
  if (path !== "/")
    graph.push({
      "@type": "BreadcrumbList",
      "@id": url + "#breadcrumb",
      itemListElement: pageBreadcrumbs(path, post).map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: SITE_URL + item.path,
      })),
    });
  if (post)
    graph.push({
      "@type": "DiscussionForumPosting",
      "@id": url + "#post",
      url,
      mainEntityOfPage: { "@id": url + "#webpage" },
      headline: post.title,
      text: post.body,
      articleSection: categories[post.category],
      datePublished: post.createdAt,
      dateModified: post.updatedAt ?? post.createdAt,
      author: { "@type": "Person", name: post.author },
      inLanguage: "ko-KR",
      ...(post.imageUrl
        ? { image: new URL(post.imageUrl, SITE_URL).href }
        : {}),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
