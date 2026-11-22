"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateKey, loadLogs, loadMeta, loadMyPrices, loadProfile } from "@/lib/store";
import { accountsEnabled } from "@/lib/supabase";
import { deleteAccount, signOut, syncNow } from "@/lib/sync";
import { useAppData, type SyncState } from "../useAppData";

const SYNC_LABEL: Record<SyncState, string> = {
  local: "이 기기에만 저장 중",
  syncing: "계정과 맞추는 중…",
  synced: "계정과 맞춰졌어요",
  error: "계정과 맞추지 못했어요",
};

// 내 계정: 로그인 상태 · 동기화 · 로그아웃 · 회원 탈퇴
export default function AccountPage() {
  const router = useRouter();
  const { ready, account, sync, syncAgain, logs } = useAppData();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!ready) return <p className="muted">불러오는 중…</p>;

  const days = Object.values(logs).filter((d) => d.entries.length).length;
  const meta = loadMeta();
  const last = meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString("ko-KR") : null;
  const pending = (meta.dirtyDays?.length ?? 0) + (meta.dirtyState ? 1 : 0);

  if (!accountsEnabled) {
    return (
      <>
        <h1>내 계정</h1>
        <p className="panel muted">계정 기능을 준비하고 있어요. 지금은 기록이 이 기기에만 저장돼요.</p>
      <DataExport />
      </>
    );
  }

  if (!account) {
    return (
      <>
        <h1>내 계정</h1>
        <section className="panel">
          <p>
            지금은 로그인하지 않아서 기록이 <b>이 기기에만</b> 저장돼요 (기록한 날 {days}일).
          </p>
          <p className="muted">
            로그인하면 휴대폰과 PC에서 같은 목표 · 기록 · 내 가격을 볼 수 있어요. 이 기기 기록은 처음 로그인할 때 계정으로
            옮겨요.
          </p>
          <Link href="/login" className="button primary">
            로그인 · 회원가입
          </Link>
        </section>
      <DataExport />
      </>
    );
  }

  async function logout() {
    setBusy(true);
    // 로그아웃하면 이 기기 데이터를 지우므로, 아직 못 올린 변경을 먼저 올린다
    await syncNow();
    const m = loadMeta();
    const left = (m.dirtyDays?.length ?? 0) + (m.dirtyState ? 1 : 0);
    if (left && !window.confirm(`아직 계정에 올리지 못한 변경이 ${left}건 있어요. 로그아웃하면 이 기기에서 사라져요. 그래도 로그아웃할까요?`)) {
      setBusy(false);
      return;
    }
    await signOut();
    router.replace("/login");
  }

  async function removeAccount() {
    setBusy(true);
    const err = await deleteAccount();
    setBusy(false);
    if (err) setError(`탈퇴하지 못했어요: ${err}`);
    else router.replace("/setup");
  }

  return (
    <>
      <h1>내 계정</h1>
      <section className="panel">
        <div className="stats">
          <div className="stat">
            <span>로그인한 이메일</span>
            <b>{account.email}</b>
          </div>
          <div className={`stat${sync === "synced" ? " strong" : ""}`}>
            <span>동기화</span>
            <b>{SYNC_LABEL[sync]}</b>
          </div>
        </div>
        <p className="muted small">
          기록한 날 {days}일 · 마지막으로 맞춘 시각 {last ?? "-"}
          {pending > 0 && ` · 아직 못 올린 변경 ${pending}건 (인터넷이 연결되면 다시 올려요)`}
        </p>
        <div className="plan-actions">
          <button type="button" onClick={() => void syncAgain()} disabled={sync === "syncing"}>
            지금 동기화
          </button>
          <button type="button" onClick={() => void logout()} disabled={busy}>
            로그아웃
          </button>
        </div>
        <p className="muted small">
          로그아웃하면 이 기기에 저장된 기록은 지워져요(계정에는 그대로 남아 있어요). 다른 사람과 같이 쓰는 기기라면 꼭
          로그아웃하세요.
        </p>
      </section>

      <section className="panel">
        <h2>회원 탈퇴</h2>
        <p className="muted">
          계정과 계정에 저장된 목표 · 기록 · 내 가격이 <b>모두 지워지고 되돌릴 수 없어요.</b>
        </p>
        <label className="form-grid">
          <span className="small muted">확인을 위해 &quot;탈퇴&quot;라고 적어 주세요</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button
          type="button"
          className="danger-button"
          disabled={confirm !== "탈퇴" || busy}
          onClick={() => void removeAccount()}
        >
          계정과 모든 기록 지우기
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      <p className="muted small">
        <Link href="/privacy">개인정보 처리방침</Link>
      </p>
      <DataExport />
    </>
  );
}

// 내 기록 백업: 이 기기에 있는 목표 · 기록 · 내 가격을 JSON 파일로 내려받는다 (자동 백업이 없어서 직접 보관용)
function DataExport() {
  function download() {
    const data = {
      app: "jachwifit",
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      logs: loadLogs(),
      prices: loadMyPrices(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `jachwifit-${dateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel">
      <h2>내 기록 내려받기</h2>
      <p className="muted small">목표 · 식사 기록 · 몸무게 · 내 가격을 JSON 파일 하나로 저장해요. 백업용으로 보관하세요.</p>
      <button type="button" className="button" onClick={download}>
        JSON 파일로 내려받기
      </button>
    </section>
  );
}
