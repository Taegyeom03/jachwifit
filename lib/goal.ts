// F1. 목표 설정 계산 (PRD 5.2)

export type Sex = "male" | "female";

export type Profile = {
  heightCm: number;
  age: number;
  sex: Sex;
  weightKg: number;
  targetWeightKg: number;
  activity: number; // ACTIVITY_LEVELS 인덱스
  proteinPerKg: number; // 1.2 ~ 1.6
  weeklyLossKg: number; // 주당 목표 감량
};

export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: "거의 안 움직임", detail: "앉아서 공부 · 운동 없음" },
  { factor: 1.375, label: "가벼운 활동", detail: "주 1~3회 가벼운 운동" },
  { factor: 1.55, label: "보통 활동", detail: "주 3~5회 운동" },
  { factor: 1.725, label: "활동 많음", detail: "주 6~7회 운동" },
  { factor: 1.9, label: "매우 많음", detail: "운동선수 · 육체노동" },
];

export const WEEKLY_LOSS_OPTIONS = [0.25, 0.5, 0.75, 1];

export const KCAL_PER_KG = 7700;

export type Goal = {
  bmr: number;
  tdee: number;
  targetKcal: number; // 하루 목표 섭취 칼로리
  targetProtein: number;
  targetCarb: number;
  targetFat: number;
  targetFiber: number;
  dailyDeficit: number; // 실제 적용된 하루 적자
  weeklyLossKg: number; // 실제 예상 주당 감량
  weeks: number | null; // 예상 기간(주), 감량할 게 없으면 null
  floorApplied: boolean; // BMR 하한이 적용됐는지
  warnings: string[];
};

export function calcBmr(p: Pick<Profile, "weightKg" | "heightCm" | "age" | "sex">): number {
  // Mifflin-St Jeor
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === "male" ? 5 : -161);
}

export function calcGoal(p: Profile): Goal {
  const bmr = calcBmr(p);
  const tdee = bmr * ACTIVITY_LEVELS[p.activity].factor;
  const wantDeficit = (p.weeklyLossKg * KCAL_PER_KG) / 7;

  // 목표 섭취는 BMR보다 낮아지지 않게
  const targetKcal = Math.max(tdee - wantDeficit, bmr);
  const floorApplied = tdee - wantDeficit < bmr;
  const dailyDeficit = tdee - targetKcal;
  const weeklyLossKg = (dailyDeficit * 7) / KCAL_PER_KG;

  const toLose = p.weightKg - p.targetWeightKg;
  const weeks = toLose > 0 && dailyDeficit > 0 ? Math.ceil((toLose * KCAL_PER_KG) / (dailyDeficit * 7)) : null;

  const targetProtein = p.weightKg * p.proteinPerKg;
  const targetFat = (targetKcal * 0.25) / 9; // 지방 25%
  const targetCarb = Math.max(0, (targetKcal - targetProtein * 4 - targetFat * 9) / 4);
  // 한국인 영양소 섭취기준 성인 식이섬유 충분섭취량(대략값)
  const targetFiber = p.sex === "male" ? 30 : 20;

  const warnings: string[] = [];
  if (p.weeklyLossKg >= 1) {
    warnings.push("주당 1kg 감량은 빠른 편이에요. 근손실과 요요가 생기기 쉬우니 0.5kg 정도를 추천해요.");
  }
  if (floorApplied) {
    warnings.push(
      `기초대사량(${Math.round(bmr)}kcal)보다 적게 먹지 않도록 목표를 맞췄어요. 실제 예상 감량은 주당 약 ${weeklyLossKg.toFixed(2)}kg이에요.`,
    );
  }
  const bmi = p.targetWeightKg / (p.heightCm / 100) ** 2;
  if (bmi < 18.5) {
    warnings.push(`목표 체중의 BMI가 ${bmi.toFixed(1)}로 저체중 범위예요. 목표 체중을 다시 생각해 보세요.`);
  }
  if (toLose <= 0) {
    warnings.push("목표 체중이 현재 체중 이상이에요. 감량 기간은 계산하지 않아요.");
  }

  return {
    bmr,
    tdee,
    targetKcal,
    targetProtein,
    targetCarb,
    targetFat,
    targetFiber,
    dailyDeficit,
    weeklyLossKg,
    weeks,
    floorApplied,
    warnings,
  };
}

export function validateProfile(p: Profile): string | null {
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return "키는 120~230cm 사이로 입력해 주세요.";
  if (!(p.age >= 15 && p.age <= 80)) return "나이는 15~80세 사이로 입력해 주세요.";
  if (!(p.weightKg >= 30 && p.weightKg <= 250)) return "현재 체중은 30~250kg 사이로 입력해 주세요.";
  if (!(p.targetWeightKg >= 30 && p.targetWeightKg <= 250)) return "목표 체중은 30~250kg 사이로 입력해 주세요.";
  return null;
}
