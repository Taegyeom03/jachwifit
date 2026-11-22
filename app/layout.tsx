import type { Metadata, Viewport } from "next";
import Link from "next/link";
import AccountLink from "./components/AccountLink";
import Nav from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "자취핏",
  description: "자취생이 최소 비용으로 건강하게 다이어트하도록 돕는 식단 도우미",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Nav />
        <main className="container">
          <AccountLink />
          {children}
        </main>
        <footer className="footer">
          일반적인 추정치이며 의료 조언이 아니에요. 질환이 있거나 임신 중이라면 전문가와 상담하세요. ·{" "}
          <Link href="/privacy">개인정보 처리방침</Link>
        </footer>
      </body>
    </html>
  );
}
