import type { Metadata } from "next";
import type { Post } from "./types";

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
  if (["home", "my", "report"].includes(section)) return path.length === 1;
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
    robots: { index, follow: true },
    openGraph: {
      type: "website",
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
