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

export type DayStatus = "none" | "good" | "near" | "over";

// 캘린더 색상: 목표 이하 초록 · 10% 이내 초과 노랑 · 10% 넘게 초과 빨강
export function dayStatus(day: DayLog | undefined, goal: Goal): DayStatus {
  if (!day?.entries.length) return "none";
  const ratio = dayTotals(day).kcal / goal.targetKcal;
  if (ratio <= 1) return "good";
  if (ratio <= 1.1) return "near";
  return "over";
}
