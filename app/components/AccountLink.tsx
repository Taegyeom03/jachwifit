"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { accountsEnabled, getSupabase } from "@/lib/supabase";

// 아래쪽 계정 표시: 로그인했으면 이메일 · 내 계정, 아니면 "로그인하면 폰 · PC 연동"
export default function AccountLink() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null);
      // 재설정 메일 링크로 들어왔는데 /reset 이 아닌 곳(예: 첫 화면)으로 왔으면 새 비밀번호 화면으로 보낸다
      if (event === "PASSWORD_RECOVERY" && pathname !== "/reset") router.push("/reset");
    });
    return () => data.subscription.unsubscribe();
  }, [pathname, router]);

  if (!accountsEnabled || email === undefined) return null;

  return (
    <p className="account-link">
      {email ? (
        <>
          <Link href="/account">{email}</Link> · 폰 · PC 연동 중
        </>
      ) : (
        <>
          <Link href="/login">로그인</Link>하면 휴대폰과 PC에서 같은 기록을 볼 수 있어요.
        </>
      )}
    </p>
  );
}
