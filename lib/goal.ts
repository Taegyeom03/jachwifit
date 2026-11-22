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
  startDate?: string; // 계획을 시작한 날(YYYY-MM-DD). 체중 · 목표 · 감량 속도를 바꾸면 새로 시작한다
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

// 2025 한국인 영양소 섭취기준 (보건복지부 · 한국영양학회) 요약표
export const KDRI_SOURCE = "2025 한국인 영양소 섭취기준(보건복지부)";
// 에너지적정비율(%): 3세 이상 · 성인 공통
export const AMDR = { carb: [50, 65], protein: [10, 20], fat: [15, 30] } as const;
// 탄수화물 권장섭취량(g/일)
export const CARB_RNI = 130;
// 식이섬유 충분섭취량(g/일): [이 나이 이상, 남, 여]
const FIBER_AI: [number, number, number][] = [
  [65, 30, 25],
  [50, 30, 25],
  [19, 30, 20],
  [12, 25, 20],
];

export function fiberAdequateIntake(sex: Sex, age: number): number {
  const row = FIBER_AI.find(([minAge]) => age >= minAge) ?? FIBER_AI[FIBER_AI.length - 1];
  return sex === "male" ? row[1] : row[2];
}

// 지방은 에너지적정비율(15~30%) 안에서 25%, 탄수화물은 남은 칼로리
const FAT_RATIO = 0.25;

export type Goal = {
  bmr: number;
  activityFactor: number;
  tdee: number;
  wantDeficit: number; // 감량 속도로 정한 하루 적자
  targetKcal: number; // 하루 목표 섭취 칼로리
  targetProtein: number;
  targetCarb: number;
  targetFat: number;
  targetFiber: number;
  macroPct: { carb: number; protein: number; fat: number }; // 목표의 에너지 비율(%)
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
  const activityFactor = ACTIVITY_LEVELS[p.activity].factor;
  const tdee = bmr * activityFactor;
  const wantDeficit = (p.weeklyLossKg * KCAL_PER_KG) / 7;

  // 목표 섭취는 BMR보다 낮아지지 않게
  const targetKcal = Math.max(tdee - wantDeficit, bmr);
  const floorApplied = tdee - wantDeficit < bmr;
  const dailyDeficit = tdee - targetKcal;
  const weeklyLossKg = (dailyDeficit * 7) / KCAL_PER_KG;

  const toLose = p.weightKg - p.targetWeightKg;
  const weeks = toLose > 0 && dailyDeficit > 0 ? Math.ceil((toLose * KCAL_PER_KG) / (dailyDeficit * 7)) : null;

  const targetProtein = p.weightKg * p.proteinPerKg;
  const targetFat = (targetKcal * FAT_RATIO) / 9;
  const targetCarb = Math.max(0, (targetKcal - targetProtein * 4 - targetFat * 9) / 4);
  const targetFiber = fiberAdequateIntake(p.sex, p.age);
  const macroPct = {
    carb: ((targetCarb * 4) / targetKcal) * 100,
    protein: ((targetProtein * 4) / targetKcal) * 100,
    fat: FAT_RATIO * 100,
  };

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
  if (macroPct.protein > AMDR.protein[1]) {
    warnings.push(
      `단백질이 목표 칼로리의 ${macroPct.protein.toFixed(0)}%로 권장 범위(${AMDR.protein[0]}~${AMDR.protein[1]}%)보다 높아요. 체중 1kg당 단백질을 낮춰 보세요.`,
    );
  }
  if (macroPct.carb < AMDR.carb[0] || targetCarb < CARB_RNI) {
    warnings.push(
      `탄수화물이 목표 칼로리의 ${macroPct.carb.toFixed(0)}%(${Math.round(targetCarb)}g)로 권장(${AMDR.carb[0]}~${AMDR.carb[1]}%, 하루 ${CARB_RNI}g 이상)보다 적어요.`,
    );
  }

  return {
    bmr,
    activityFactor,
    tdee,
    wantDeficit,
    targetKcal,
    targetProtein,
    targetCarb,
    targetFat,
    targetFiber,
    macroPct,
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
