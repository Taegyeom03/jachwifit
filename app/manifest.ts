// 홈 화면에 추가(PWA): 휴대폰에서 아이콘을 누르면 주소창 없이 앱처럼 열린다
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "자취핏 · 자취생 칼로리 플래너",
    short_name: "자취핏",
    description: "얼마나 · 뭘 · 얼마에 먹을지 정해 주는 자취생 다이어트 식단 도우미",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f5",
    theme_color: "#2f9e44",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
