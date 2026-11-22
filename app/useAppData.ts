"use client";

import { useCallback, useEffect, useState } from "react";
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

  const apply = useCallback((d: LocalData) => {
    applyMyPrices(d.prices);
    setMyPricesState(d.prices);
    setProfileState(d.profile);
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
        apply(res.data);
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
    setLogsState(loadLogs());
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

  const updateDay = useCallback((key: string, update: (day: DayLog) => DayLog) => {
    setLogsState((prev) => {
      const day = { ...update(prev[key] ?? { entries: [] }), updatedAt: Date.now() };
      const next = { ...prev, [key]: day };
      setSaveError(!saveLogs(next));
      void pushDay(key, day);
      return next;
    });
  }, []);

  // 1회 제공량 가격(원)을 저장한다. null이면 내 가격을 지우고 데이터셋 값으로 되돌린다.
  const setMyPrice = useCallback((foodId: number, price: number | null) => {
    setMyPricesState((prev) => {
      const next = { ...prev };
      if (price == null) delete next[String(foodId)];
      else next[String(foodId)] = { price: Math.round(price), date: dateKey(new Date()) };
      applyMyPrices(next);
      setSaveError(!saveMyPrices(next));
      updateMeta({ pricesAt: Date.now() });
      void pushState();
      return next;
    });
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
