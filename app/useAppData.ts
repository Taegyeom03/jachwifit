"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyMyPrices } from "@/lib/foods";
import type { Profile } from "@/lib/goal";
import {
  dateKey,
  loadLogs,
  loadMyPrices,
  loadProfile,
  saveLogs,
  saveMyPrices,
  saveProfile,
  updateMeta,
  type DayLog,
  type Logs,
  type MyPrices,
} from "@/lib/store";
import { currentUser, pushDay, pushState, syncNow, type LocalData } from "@/lib/sync";

export type SyncState = "local" | "syncing" | "synced" | "error";

const RESYNC_MS = 20_000; // 앱으로 돌아왔을 때 이보다 오래 지났으면 다시 받아 온다
let lastSync = 0;

// 저장소에서 프로필 · 기록 · 내 가격을 읽고, 바꿀 때마다 저장한다.
// 로그인돼 있으면 계정(Supabase)에서 받아 와 합치고, 고친 것은 계정에도 올린다.
// 서버 렌더링과 어긋나지 않도록 화면이 뜬 뒤(useEffect)에 읽는다.
export function useAppData() {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [logs, setLogsState] = useState<Logs>({});
  const [myPrices, setMyPricesState] = useState<MyPrices>({});
  const [saveError, setSaveError] = useState(false);
  const [account, setAccount] = useState<{ email: string } | null>(null);
  const [sync, setSync] = useState<SyncState>("local");
  // 첫 동기화가 끝났는지 (다른 기기에서 처음 로그인하면 받아 오기 전까지는 이 기기에 목표가 없다)
  const [settled, setSettled] = useState(false);

  // 저장소를 못 쓰는 브라우저(시크릿 모드 등)에서도 이번 화면 동안은 기록이 유지되게 메모리에도 둔다
  const logsRef = useRef<Logs>({});

  const apply = useCallback((d: LocalData) => {
    applyMyPrices(d.prices);
    setMyPricesState(d.prices);
    setProfileState(d.profile);
    logsRef.current = d.logs;
    setLogsState(d.logs);
  }, []);

  const pull = useCallback(
    async (force = false) => {
      if (!force && Date.now() - lastSync < RESYNC_MS) return;
      const user = await currentUser();
      setAccount(user ? { email: user.email } : null);
      if (!user) {
        setSync("local");
        return;
      }
      setSync("syncing");
      const res = await syncNow();
      lastSync = Date.now();
      if (res.status === "ok") {
        // 동기화가 올리는 동안 사용자가 기록했을 수 있으니, 결과 대신 지금 저장소를 다시 읽어 보여 준다
        const logs = loadLogs();
        apply({
          profile: loadProfile() ?? res.data.profile,
          logs: Object.keys(logs).length ? logs : res.data.logs,
          prices: loadMyPrices(),
        });
        setSync("synced");
      } else setSync(res.status === "error" ? "error" : "local");
    },
    [apply],
  );

  useEffect(() => {
    const prices = loadMyPrices();
    // 화면이 음식 가격을 읽기 전에 내 가격을 덮어쓴다
    applyMyPrices(prices);
    setMyPricesState(prices);
    setProfileState(loadProfile());
    logsRef.current = loadLogs();
    setLogsState(logsRef.current);
    setReady(true);

    // 이 기기 데이터로 먼저 보여 주고, 계정 데이터를 받아 와 합친다
    void pull(true).finally(() => setSettled(true));
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pull]);

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p);
    const ok = saveProfile(p);
    updateMeta({ profileAt: Date.now() });
    setSaveError(!ok);
    void pushState();
  }, []);

  // 하루 기록을 고친다. 저장소의 최신 값(동기화로 받은 것 포함)을 기준으로 고쳐서 덮어쓰지 않는다.
  // silent: 추천 지표처럼 사용자가 고친 게 아닌 값은 고친 시각을 올리지 않고 이 기기에만 저장한다
  // (시각을 올리면 이 기기의 옛 기록이 계정의 새 기록을 이겨 버린다)
  const updateDay = useCallback((key: string, update: (day: DayLog) => DayLog, opts?: { silent?: boolean }) => {
    const base = { ...logsRef.current, ...loadLogs() };
    const prevDay = base[key] ?? { entries: [] };
    const changed = update(prevDay);
    const day = opts?.silent ? { ...changed, updatedAt: prevDay.updatedAt } : { ...changed, updatedAt: Date.now() };
    const next = { ...base, [key]: day };
    logsRef.current = next;
    setLogsState(next);
    setSaveError(!saveLogs(next));
    if (!opts?.silent) void pushDay(key, day);
  }, []);

  // 1회 제공량 가격(원)을 저장한다. null이면 내 가격을 지우고 데이터셋 값으로 되돌린다.
  const setMyPrice = useCallback((foodId: number, price: number | null) => {
    const next = { ...loadMyPrices() };
    if (price == null) delete next[String(foodId)];
    else next[String(foodId)] = { price: Math.round(price), date: dateKey(new Date()) };
    applyMyPrices(next);
    setMyPricesState(next);
    setSaveError(!saveMyPrices(next));
    updateMeta({ pricesAt: Date.now() });
    void pushState();
  }, []);

  return {
    ready,
    profile,
    setProfile,
    logs,
    updateDay,
    myPrices,
    setMyPrice,
    saveError,
    account,
    sync,
    settled,
    syncAgain: () => pull(true),
  };
}
