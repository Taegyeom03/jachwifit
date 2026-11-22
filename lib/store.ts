// 내 기록 저장소. 이 기기의 브라우저 저장소(localStorage)에 둔다.
// 로그인하면 lib/sync.ts가 같은 내용을 계정(Supabase)과 맞춘다. 로그인하지 않으면 이 기기에만 남는다.
import type { Profile } from "./goal";

export const MEALS = ["아침", "점심", "저녁", "간식", "야식"] as const;
export type Meal = (typeof MEALS)[number];

// 지금 시각에 맞는 기본 끼니
export function mealByHour(h: number): Meal {
  if (h < 10) return "아침";
  if (h < 15) return "점심";
  if (h < 17) return "간식";
  if (h < 21) return "저녁";
  return "야식";
}

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
  updatedAt?: number; // 마지막으로 고친 시각(ms). 두 기기 기록을 맞출 때 더 최근 것을 쓴다
};

export type Logs = Record<string, DayLog>; // 키: YYYY-MM-DD

// 내가 입력한 가격: 음식 id → 1회 제공량 가격(원)과 입력한 날
export type MyPrices = Record<string, { price: number; date: string }>;

// 동기화 정보: 이 기기 데이터가 어느 계정 것인지, 목표 · 가격을 언제 고쳤는지, 아직 못 올린 것
export type SyncMeta = {
  userId?: string;
  profileAt?: number;
  pricesAt?: number;
  dirtyState?: boolean; // 목표 · 가격을 아직 계정에 못 올림
  dirtyDays?: string[]; // 아직 계정에 못 올린 날짜
  lastSyncAt?: number;
};

const PROFILE_KEY = "jachwifit.profile";
const LOGS_KEY = "jachwifit.logs";
const PRICES_KEY = "jachwifit.prices";
const META_KEY = "jachwifit.meta";

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
export const loadMeta = () => read<SyncMeta>(META_KEY) ?? {};
export const saveMeta = (meta: SyncMeta) => write(META_KEY, meta);
export const updateMeta = (patch: Partial<SyncMeta>) => saveMeta({ ...loadMeta(), ...patch });

// 이 기기에 저장된 자취핏 데이터를 모두 지운다 (로그아웃 · 다른 계정 로그인 · 탈퇴)
export function clearLocal(): void {
  for (const key of [PROFILE_KEY, LOGS_KEY, PRICES_KEY, META_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 저장소를 못 쓰는 브라우저면 지울 것도 없다
    }
  }
}

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
