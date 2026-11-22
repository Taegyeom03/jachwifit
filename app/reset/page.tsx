"use client";

// 비밀번호 재설정: 메일 링크로 들어오면(일시 로그인 상태) 새 비밀번호를 정한다
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { accountsEnabled, authErrorMessage, getSupabase } from "@/lib/supabase";

export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    // 링크의 토큰을 supabase-js가 읽어 세션을 만드는 데 잠깐 걸린다
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) setHasSession(true);
    });
    void sb.auth.getSession().then(({ data: d }) => {
      setHasSession(!!d.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("비밀번호는 6자 이상으로 해 주세요.");
    if (password !== again) return setError("두 비밀번호가 달라요.");
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(authErrorMessage(error.message));
    else setDone(true);
  }

  if (!accountsEnabled) return <p className="panel muted">계정 기능이 꺼져 있어요.</p>;
  if (!ready) return <p className="muted">확인하는 중…</p>;

  if (done) {
    return (
      <section className="panel center">
        <h1>비밀번호를 바꿨어요</h1>
        <p>이제 새 비밀번호로 로그인할 수 있어요.</p>
        <Link href="/" className="button primary">
          오늘로 가기
        </Link>
      </section>
    );
  }

  if (!hasSession) {
    return (
      <section className="panel center">
        <h1>링크가 만료됐어요</h1>
        <p className="muted">재설정 링크가 오래됐거나 이미 썼어요. 메일을 다시 받아 주세요.</p>
        <Link href="/login" className="button primary">
          재설정 메일 다시 받기
        </Link>
      </section>
    );
  }

  return (
    <>
      <h1>새 비밀번호 정하기</h1>
      <form onSubmit={submit} className="panel form-grid auth-form">
        <label className="full">
          새 비밀번호 <span className="small">(6자 이상)</span>
          <input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="full">
          한 번 더
          <input type="password" autoComplete="new-password" minLength={6} value={again} onChange={(e) => setAgain(e.target.value)} required />
        </label>
        {error && <p className="error full">{error}</p>}
        <button type="submit" className="primary full" disabled={busy}>
          {busy ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </button>
      </form>
    </>
  );
}
