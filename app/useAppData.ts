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
  type DayLog,
  type Logs,
  type MyPrices,
} from "@/lib/store";

// 저장소에서 프로필 · 기록 · 내 가격을 읽고, 바꿀 때마다 저장한다.
// 서버 렌더링과 어긋나지 않도록 화면이 뜬 뒤(useEffect)에 읽는다.
export function useAppData() {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [logs, setLogsState] = useState<Logs>({});
  const [myPrices, setMyPricesState] = useState<MyPrices>({});
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const prices = loadMyPrices();
    // 화면이 음식 가격을 읽기 전에 내 가격을 덮어쓴다
    applyMyPrices(prices);
    setMyPricesState(prices);
    setProfileState(loadProfile());
    setLogsState(loadLogs());
    setReady(true);
  }, []);

  const setProfile = useCallback((p: Profile) => {
    setProfileState(p);
    setSaveError(!saveProfile(p));
  }, []);

  const updateDay = useCallback((key: string, update: (day: DayLog) => DayLog) => {
    setLogsState((prev) => {
      const next = { ...prev, [key]: update(prev[key] ?? { entries: [] }) };
      setSaveError(!saveLogs(next));
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
      return next;
    });
  }, []);

  return { ready, profile, setProfile, logs, updateDay, myPrices, setMyPrice, saveError };
}
