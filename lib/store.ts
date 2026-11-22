// 내 기록 저장소. MVP는 단일 사용자라 브라우저 저장소(localStorage)에 둔다.
// 나중에 DB로 옮길 때 이 파일만 바꾸면 되도록 읽기 · 쓰기를 여기로 모은다.
import type { Profile } from "./goal";

export const MEALS = ["아침", "점심", "저녁", "간식", "야식"] as const;
export type Meal = (typeof MEALS)[number];

export type Unit = "serving" | "g";

export type Entry = {
  id: string;
  foodId: number;
  amount: number;
  unit: Unit;
  meal: Meal;
};

// 그날 마지막으로 본 추천 결과 (PRD Q6 성공 지표 측정용)
// met: 단백질 목표 달성 · noKcal: 남은 칼로리 없음 · shown: 추천을 보여 줌
export type RecStat =
  | { status: "met" }
  | { status: "noKcal" }
  | { status: "shown"; coverage: number; over: number };

export type DayLog = {
  entries: Entry[];
  rec?: RecStat;
  cheat?: boolean; // 치팅데이
};

export type Logs = Record<string, DayLog>; // 키: YYYY-MM-DD

// 내가 입력한 가격: 음식 id → 1회 제공량 가격(원)과 입력한 날
export type MyPrices = Record<string, { price: number; date: string }>;

const PROFILE_KEY = "jachwifit.profile";
const LOGS_KEY = "jachwifit.logs";
const PRICES_KEY = "jachwifit.prices";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadProfile = () => read<Profile>(PROFILE_KEY);
export const saveProfile = (p: Profile) => write(PROFILE_KEY, p);
export const loadLogs = () => read<Logs>(LOGS_KEY) ?? {};
export const saveLogs = (logs: Logs) => write(LOGS_KEY, logs);
export const loadMyPrices = () => read<MyPrices>(PRICES_KEY) ?? {};
export const saveMyPrices = (prices: MyPrices) => write(PRICES_KEY, prices);

// 로컬 시간 기준 날짜 키
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
