"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "오늘" },
  { href: "/calendar", label: "캘린더" },
  { href: "/setup", label: "목표 설정" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <Link href="/" className="brand">
        자취핏
      </Link>
      <nav>
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className={pathname === href ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
