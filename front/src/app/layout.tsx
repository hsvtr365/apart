import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "@/components/store";
export const metadata: Metadata = {
  title: { default: "햇빛마을20단지", template: "%s · 햇빛마을20단지" },
  description:
    "우리 단지의 먹거리, 생활 소식과 이웃의 제보를 한눈에 확인하세요.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
