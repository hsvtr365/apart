import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "@/components/store";
import { getBootstrap } from "@/lib/bootstrap";
import { SITE_DESCRIPTION } from "@/lib/seo";
export const metadata: Metadata = {
  metadataBase: new URL("https://apart.jujeop.com"),
  title: { default: "햇빛마을20단지", template: "%s · 햇빛마을20단지" },
  description: SITE_DESCRIPTION,
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: {
      ...(process.env.NAVER_SITE_VERIFICATION
        ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION }
        : {}),
      ...(process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : {}),
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=3" },
      { url: "/brand/icon-32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-48.png?v=3", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/brand/icon-180.png?v=3", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "햇빛마을20단지",
    title: "햇빛마을20단지",
    description: "우리 단지의 먹거리, 요일장과 공고를 한눈에 확인하세요.",
    images: [
      {
        url: "/brand/share-banner.png",
        width: 1200,
        height: 630,
        alt: "햇빛마을20단지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "햇빛마을20단지",
    description: "우리 단지의 먹거리, 요일장과 공고를 한눈에 확인하세요.",
    images: ["/brand/share-banner.png"],
  },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialData = await getBootstrap();
  return (
    <html lang="ko">
      <body>
        <Provider initialData={initialData} initialNow={Date.now()}>
          {children}
        </Provider>
      </body>
    </html>
  );
}
