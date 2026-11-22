// 캘린더 색 · 치팅데이 상한 · 몸무게 진행(lib/nutrition.ts, lib/plan.ts) 단위 테스트
import { describe, expect, it } from "vitest";
import { findFood } from "@/lib/foods";
import { calcGoal, type Goal, type Profile } from "@/lib/goal";
import { dayStatus, dayTotals, kcalLimit } from "@/lib/nutrition";
import { weightProgress } from "@/lib/plan";
import type { DayLog } from "@/lib/store";

const EGG = 2; // 계란 (1회 제공량 기준)
const egg = findFood(EGG)!;
// 계산을 단순하게: 목표 = 계란 1개 칼로리 정확히, 유지 칼로리는 그 2배
const goal = { targetKcal: egg.kcal, tdee: egg.kcal * 2 } as Goal;
const day = (servings: number, cheat = false): DayLog => ({
  entries: [{ id: "t", foodId: EGG, amount: servings, unit: "serving", meal: "아침" }],
  cheat,
});

describe("dayStatus (캘린더 색)", () => {
  it("기록이 없으면 none", () => {
    expect(dayStatus(undefined, goal)).toBe("none");
    expect(dayStatus({ entries: [] }, goal)).toBe("none");
  });
  it("목표 이하 → good, 10% 이내 초과 → near, 10% 넘게 → over (경계 포함)", () => {
    expect(dayStatus(day(1), goal)).toBe("good"); // 정확히 100%
    expect(dayStatus(day(1.05), goal)).toBe("near");
    expect(dayStatus(day(1.1), goal)).toBe("near"); // 정확히 110%
    expect(dayStatus(day(1.2), goal)).toBe("over");
  });
  it("치팅데이는 유지 칼로리까지가 상한", () => {
    expect(kcalLimit(goal, day(1, true))).toBe(goal.tdee);
    expect(dayStatus(day(1.5, true), goal)).toBe("good");
  });
});

describe("dayTotals", () => {
  it("g 단위 기록은 1회 제공량 무게로 환산한다", () => {
    const t = dayTotals({ entries: [{ id: "g", foodId: EGG, amount: egg.servingG * 2, unit: "g", meal: "아침" }] });
    expect(t.kcal).toBeCloseTo(egg.kcal * 2, 6);
  });
  it("없는 음식 id는 0으로 무시하고 오류를 내지 않는다", () => {
    expect(dayTotals({ entries: [{ id: "x", foodId: 99999, amount: 1, unit: "serving", meal: "아침" }] }).kcal).toBe(0);
  });
});

describe("weightProgress (계획 vs 실제)", () => {
  const profile: Profile = {
    heightCm: 175, age: 24, sex: "male", weightKg: 80, targetWeightKg: 72,
    activity: 1, proteinPerKg: 1.4, weeklyLossKg: 0.5, startDate: "2026-11-02",
  };
  const g = calcGoal(profile);
  it("2주 뒤 계획은 1kg 감량, 실제 78.6kg면 계획보다 0.4kg 빠름", () => {
    const p = weightProgress(profile, g, { "2026-11-16": { weight: 78.6 } });
    expect(p.latest?.day).toBe(14);
    expect(p.plannedAtLatest).toBeCloseTo(79, 6);
    expect(p.diff).toBeCloseTo(-0.4, 6);
  });
  it("시작일 이전 기록은 그래프에서 뺀다", () => {
    const p = weightProgress(profile, g, { "2026-10-01": { weight: 82 }, "2026-11-03": { weight: 79.9 } });
    expect(p.records.map((r) => r.date)).toEqual(["2026-11-03"]);
  });
});
