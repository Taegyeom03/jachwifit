"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/goal";
import { loadLogs, loadProfile, saveLogs, saveProfile, type DayLog, type Logs } from "@/lib/store";

// 저장소에서 프로필과 기록을 읽고, 바꿀 때마다 저장한다.
// 서버 렌더링과 어긋나지 않도록 화면이 뜬 뒤(useEffect)에 읽는다.
export function useAppData() {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [logs, setLogsState] = useState<Logs>({});
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
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

  return { ready, profile, setProfile, logs, updateDay, saveError };
}
