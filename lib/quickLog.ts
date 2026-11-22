// 기록을 빠르게: 자주 먹는 음식, 지난 기록 그대로 복사
import { findFood, type Food } from "./foods";
import type { DayLog, Entry, Logs } from "./store";

// 기준 날짜 전에 기록이 있는 가장 최근 날 (어제를 건너뛴 날도 찾는다, 최대 days일 전까지)
export function previousLoggedDay(logs: Logs, key: string, days = 14): string | null {
  const keys = Object.keys(logs)
    .filter((k) => k < key && logs[k].entries.length > 0)
    .sort();
  const last = keys.at(-1);
  if (!last) return null;
  const diff = (Date.parse(key) - Date.parse(last)) / 86_400_000;
  return diff <= days ? last : null;
}

// 최근 days일 동안 먹은 날이 많은 음식 순 (같은 날 여러 번은 1번으로 센다), 같으면 최근에 먹은 순
export function frequentFoods(logs: Logs, key: string, limit = 8, days = 30): Food[] {
  const from = new Date(Date.parse(key) - days * 86_400_000).toISOString().slice(0, 10);
  const stat = new Map<number, { days: number; last: string }>();
  for (const [k, day] of Object.entries(logs)) {
    if (k < from || k > key) continue;
    for (const id of new Set(day.entries.map((e) => e.foodId))) {
      const s = stat.get(id) ?? { days: 0, last: "" };
      s.days++;
      if (k > s.last) s.last = k;
      stat.set(id, s);
    }
  }
  return [...stat.entries()]
    .filter(([, s]) => s.days >= 2) // 한 번만 먹은 건 "자주"가 아니다
    .sort((a, b) => b[1].days - a[1].days || b[1].last.localeCompare(a[1].last))
    .map(([id]) => findFood(id))
    .filter((f): f is Food => !!f)
    .slice(0, limit);
}

// 다른 날 기록을 새 id로 복사 (끼니 · 양 그대로)
export function copyEntries(day: DayLog | undefined, makeId: () => string): Entry[] {
  return (day?.entries ?? []).map((e) => ({ ...e, id: makeId() }));
}
