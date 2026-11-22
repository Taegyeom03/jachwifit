"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountsEnabled, getSupabase } from "@/lib/supabase";

// 아래쪽 계정 표시: 로그인했으면 이메일 · 내 계정, 아니면 "로그인하면 폰 · PC 연동"
export default function AccountLink() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

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
