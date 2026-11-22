"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { accountsEnabled, authErrorMessage, getSupabase } from "@/lib/supabase";
import { syncNow } from "@/lib/sync";

type Mode = "login" | "signup" | "reset";

// 이메일 · 비밀번호 로그인 / 회원가입. 로그인하면 이 기기 기록과 계정 기록을 합친다.
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (!accountsEnabled) {
    return (
      <section className="panel center">
        <h1>계정 기능 준비 중</h1>
        <p className="muted">지금은 로그인 없이 이 기기에만 저장돼요.</p>
        <Link href="/" className="button primary">
          오늘로 가기
        </Link>
      </section>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setError("");
    setInfo("");
    if (mode === "signup" && !agree) {
      setError("개인정보 처리방침에 동의해야 가입할 수 있어요.");
      return;
    }
    setBusy(true);
    if (mode === "reset") {
      // 비밀번호 재설정 메일: 링크를 누르면 /reset 에서 새 비밀번호를 정한다
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset` });
      setBusy(false);
      if (error) setError(authErrorMessage(error.message));
      else setInfo("비밀번호 재설정 메일을 보냈어요. 메일의 링크를 누르면 새 비밀번호를 정할 수 있어요. (메일이 안 오면 스팸함을 확인해 주세요)");
      return;
    }
    const { data, error } =
      mode === "login"
        ? await sb.auth.signInWithPassword({ email: email.trim(), password })
        : await sb.auth.signUp({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(authErrorMessage(error.message));
      return;
    }
    if (!data.session) {
      // Supabase에서 이메일 인증을 켜 둔 경우
      setBusy(false);
      setInfo("가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 여기서 로그인해 주세요.");
      setMode("login");
      return;
    }
    const res = await syncNow();
    setBusy(false);
    const hasProfile = res.status === "ok" && res.data.profile;
    router.replace(hasProfile ? "/" : "/setup");
  }

  return (
    <>
      <h1>{mode === "login" ? "로그인" : mode === "signup" ? "회원가입" : "비밀번호 재설정"}</h1>
      <p className="muted">
        로그인하면 목표 · 기록 · 내 가격이 계정에 저장돼서 휴대폰과 PC 어디서든 같은 내용을 볼 수 있어요. 로그인 전에 이
        기기에 적어 둔 기록은 처음 로그인할 때 계정으로 옮겨요.
      </p>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          로그인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="panel form-grid auth-form">
        <label className="full">
          이메일
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {mode !== "reset" && (
        <label className="full">
          비밀번호 {mode === "signup" && <span className="small">(6자 이상)</span>}
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        )}
        {mode === "signup" && (
          <label className="check full">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              <Link href="/privacy" target="_blank">
                개인정보 처리방침
              </Link>
              (이메일 · 신체 정보 · 식사 기록 저장)에 동의해요.
            </span>
          </label>
        )}
        {error && <p className="error full">{error}</p>}
        {info && <p className="ok panel full">{info}</p>}
        <button type="submit" className="primary full" disabled={busy}>
          {busy ? "잠시만요…" : mode === "login" ? "로그인" : mode === "signup" ? "가입하고 시작하기" : "재설정 메일 받기"}
        </button>
        {mode === "login" && (
          <button type="button" className="link full small" onClick={() => { setMode("reset"); setError(""); setInfo(""); }}>
            비밀번호를 잊었어요
          </button>
        )}
        {mode === "reset" && (
          <button type="button" className="link full small" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>
            ← 로그인으로 돌아가기
          </button>
        )}
      </form>

      <p className="muted small">
        로그인하지 않아도 쓸 수 있어요. 그때는 기록이 이 기기에만 저장돼요. <Link href="/">로그인 없이 쓰기</Link>
      </p>
    </>
  );
}
