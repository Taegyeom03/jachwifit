// F3. 하루 섭취 합계와 달성 상태
import { findFood, type Food } from "./foods";
import type { Goal } from "./goal";
import type { DayLog, Entry } from "./store";

export type Totals = {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  price: number;
};

export const EMPTY_TOTALS: Totals = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0, price: 0 };

// 1회 제공량 대비 배수
export function servingFactor(entry: Pick<Entry, "amount" | "unit">, food: Food): number {
  return entry.unit === "g" ? entry.amount / food.servingG : entry.amount;
}

export function entryTotals(entry: Entry): Totals | null {
  const food = findFood(entry.foodId);
  if (!food) return null;
  const k = servingFactor(entry, food);
  return {
    kcal: food.kcal * k,
    protein: food.protein * k,
    carb: food.carb * k,
    fat: food.fat * k,
    fiber: food.fiber * k,
    price: food.price * k,
  };
}

export function dayTotals(day: DayLog | undefined): Totals {
  const sum = { ...EMPTY_TOTALS };
  for (const e of day?.entries ?? []) {
    const t = entryTotals(e);
    if (!t) continue;
    for (const key of Object.keys(sum) as (keyof Totals)[]) sum[key] += t[key];
  }
  return sum;
}

// 그날의 칼로리 상한: 치팅데이는 유지 칼로리(하루 소비 칼로리)까지 (무제한이 아님)
export function kcalLimit(goal: Goal, day: DayLog | undefined): number {
  return day?.cheat ? goal.tdee : goal.targetKcal;
}

// 주간 칼로리 예산 (월~일): 치팅데이 등으로 넘친 칼로리를 남은 날에 나눠 줄이는 안내용
// 매일 목표는 바꾸지 않고, 하루 기초대사량 아래로 줄이라고 안내하지 않는다 (굶어서 보상하지 않기)
export type WeekBudget = {
  budget: number; // 목표 칼로리 × 7
  eaten: number; // 월요일부터 오늘까지 먹은 칼로리
  over: number; // 월요일부터 오늘까지 목표보다 더 먹은 칼로리 (음수면 덜 먹음)
  daysLeft: number; // 내일부터 일요일까지
  perDayCut: number; // 남은 날 하루에 줄이면 되는 칼로리 (기초대사량 하한 적용)
  fullyRecoverable: boolean; // 하한 안에서 넘친 만큼 다 줄일 수 있는지
  cheatDays: number;
};

export function weekBudget(goal: Goal, logs: Record<string, DayLog>, today: Date, toKey: (d: Date) => string): WeekBudget {
  // 월요일부터 오늘까지 지난 날 수 (시각은 무시하고 요일로 센다)
  const elapsed = ((today.getDay() + 6) % 7) + 1;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (elapsed - 1));
  let eaten = 0;
  let cheatDays = 0;
  for (let i = 0; i < elapsed; i++) {
    const day = logs[toKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))];
    eaten += dayTotals(day).kcal;
    if (day?.cheat) cheatDays++;
  }
  const over = eaten - goal.targetKcal * elapsed;
  const daysLeft = 7 - elapsed;
  const maxCut = Math.max(0, goal.targetKcal - goal.bmr); // 하루에 줄일 수 있는 최대치
  const needed = daysLeft > 0 ? Math.max(0, over) / daysLeft : 0;
  return {
    budget: goal.targetKcal * 7,
    eaten,
    over,
    daysLeft,
    perDayCut: Math.min(needed, maxCut),
    fullyRecoverable: needed <= maxCut,
    cheatDays,
  };
}

export type DayStatus = "none" | "good" | "near" | "over";

// 캘린더 색상: 목표 이하 초록 · 10% 이내 초과 노랑 · 10% 넘게 초과 빨강
export function dayStatus(day: DayLog | undefined, goal: Goal): DayStatus {
  if (!day?.entries.length) return "none";
  const ratio = dayTotals(day).kcal / kcalLimit(goal, day);
  if (ratio <= 1) return "good";
  if (ratio <= 1.1) return "near";
  return "over";
}
