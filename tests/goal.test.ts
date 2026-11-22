// 목표 계산(lib/goal.ts) 단위 테스트: README 예시 숫자와 건강 가드(기초대사량 하한 · 경고)
import { describe, expect, it } from "vitest";
import { calcBmr, calcGoal, validateProfile, type Profile } from "@/lib/goal";

const base: Profile = {
  heightCm: 175,
  age: 24,
  sex: "male",
  weightKg: 80,
  targetWeightKg: 72,
  activity: 1, // 가벼운 활동 1.375
  proteinPerKg: 1.4,
  weeklyLossKg: 0.5,
};

describe("calcBmr (Mifflin-St Jeor)", () => {
  it("남성: 10×체중 + 6.25×키 − 5×나이 + 5", () => {
    expect(calcBmr(base)).toBeCloseTo(1778.75, 2);
  });
  it("여성은 남성보다 166kcal 낮다 (+5 대신 −161)", () => {
    expect(calcBmr(base) - calcBmr({ ...base, sex: "female" })).toBeCloseTo(166, 5);
  });
});

describe("calcGoal", () => {
  it("README 예시: 하루 약 1,896kcal · 단백질 112g · 16주", () => {
    const g = calcGoal(base);
    expect(Math.round(g.targetKcal)).toBe(1896);
    expect(g.targetProtein).toBeCloseTo(112, 5);
    expect(g.weeks).toBe(16);
    expect(g.floorApplied).toBe(false);
  });

  it("주당 0.5kg 감량이면 하루 적자는 550kcal (0.5 × 7,700 ÷ 7)", () => {
    expect(calcGoal(base).dailyDeficit).toBeCloseTo(550, 5);
  });

  it("목표가 기초대사량보다 낮아지면 기초대사량에서 멈추고 경고한다", () => {
    const g = calcGoal({ ...base, sex: "female", heightCm: 150, weightKg: 45, targetWeightKg: 42, age: 30, activity: 0, weeklyLossKg: 1 });
    expect(g.floorApplied).toBe(true);
    expect(g.targetKcal).toBeCloseTo(g.bmr, 5);
    expect(g.warnings.some((w) => w.includes("기초대사량"))).toBe(true);
  });

  it("목표 체중이 현재 이상이면 기간을 계산하지 않는다", () => {
    expect(calcGoal({ ...base, targetWeightKg: 85 }).weeks).toBeNull();
  });

  it("목표 체중의 BMI가 18.5 미만이면 저체중 경고", () => {
    const g = calcGoal({ ...base, targetWeightKg: 55 }); // 55 / 1.75² ≈ 17.96
    expect(g.warnings.some((w) => w.includes("저체중"))).toBe(true);
  });
});

describe("validateProfile", () => {
  it("정상 입력은 통과", () => expect(validateProfile(base)).toBeNull());
  it("키 범위(120~230cm) 밖은 거절", () => expect(validateProfile({ ...base, heightCm: 300 })).not.toBeNull());
  it("숫자가 아닌 값(NaN)은 거절", () => expect(validateProfile({ ...base, weightKg: Number("abc") })).not.toBeNull());
});
