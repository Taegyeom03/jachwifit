// 처음 시작 화면의 "내 계획": 하루 식단 예시와 주차별 예상 체중
// 계산은 AI 없이 규칙으로 한다. 식단은 밥으로 탄수화물을 먼저 잡고, 남은 칼로리 안에서
// 부족한 단백질을 기존 추천(recommend)으로 가장 싸게 채운 뒤 아침 · 점심 · 저녁에 나눈다.
import { FOODS, type Food } from "./foods";
import { KCAL_PER_KG, type Goal, type Profile } from "./goal";
import { recommend } from "./recommend";

export type PlanMeal = { meal: "아침" | "점심" | "저녁"; items: { food: Food; servings: number }[] };

export type DayPlan = {
  meals: PlanMeal[];
  kcal: number;
  protein: number;
  price: number;
};

const MEALS: PlanMeal["meal"][] = ["아침", "점심", "저녁"];
const RICE_NAME = "공기밥";

// 목표 칼로리 · 단백질에 맞춘 하루 식단 예시. variant로 다른 조합(최대 3개)을 고른다.
export function buildDayPlans(goal: Goal): DayPlan[] {
  const rice = FOODS.find((f) => f.name === RICE_NAME);
  // 기본은 끼니마다 밥 한 공기. 목표 칼로리가 적으면 하루 칼로리의 55%를 넘지 않게 줄인다 (최소 1공기)
  const baseRice = rice ? Math.max(1, Math.min(3, Math.floor((goal.targetKcal * 0.55) / rice.kcal))) : 0;
  const baseRiceKcal = rice ? rice.kcal * baseRice : 0;
  const baseRiceProtein = rice ? rice.protein * baseRice : 0;

  const combos = recommend({
    proteinGap: goal.targetProtein - baseRiceProtein,
    kcalLeft: goal.targetKcal - baseRiceKcal,
    maxItems: 5,
    maxServingsEach: 2,
  });

  return combos.map((combo) => {
    const meals: PlanMeal[] = MEALS.map((meal) => ({ meal, items: [] }));
    const add = (i: number, food: Food, servings: number) => {
      const found = meals[i].items.find((it) => it.food.id === food.id);
      if (found) found.servings += servings;
      else meals[i].items.push({ food, servings });
    };

    // 단백질 반찬을 채우고 남은 칼로리는 밥 반 공기 단위로 채워, 목표보다 너무 적게 먹지 않게 한다
    // (덜 먹으면 기초대사량 아래로 내려가 근손실 · 요요 위험)
    let riceServings = baseRice;
    if (rice) {
      const left = goal.targetKcal - combo.kcal - baseRiceKcal;
      riceServings += Math.max(0, Math.min(2, Math.floor(left / (rice.kcal / 2)) / 2));
    }
    // 밥은 저녁 → 점심 → 아침 순으로 나눈다 (반 공기 단위)
    for (let left = riceServings, i = 0; left > 0; i++) {
      const s = Math.min(1, left);
      add(2 - (i % 3), rice!, s);
      left -= s;
    }
    const riceKcal = rice ? rice.kcal * riceServings : 0;
    const riceProtein = rice ? rice.protein * riceServings : 0;
    // 단백질 반찬은 1회분씩 끼니를 돌아가며 나눠, 한 끼에 몰리지 않게
    let turn = 0;
    for (const it of combo.items) {
      for (let s = 0; s < it.servings; s++) add(turn++ % 3, it.food, 1);
    }

    return {
      meals,
      kcal: combo.kcal + riceKcal,
      protein: combo.protein + riceProtein,
      price: combo.price + (rice ? rice.price * riceServings : 0),
    };
  });
}

export type WeightPoint = { week: number; weightKg: number; date: Date };

// 0주차(오늘)부터 목표 체중까지 주차별 예상 체중
export function weightPath(profile: Profile, goal: Goal, start: Date = new Date()): WeightPoint[] {
  if (!goal.weeks) return [];
  const perWeek = (goal.dailyDeficit * 7) / KCAL_PER_KG;
  const points: WeightPoint[] = [];
  for (let w = 0; w <= goal.weeks; w++) {
    const date = new Date(start);
    date.setDate(date.getDate() + w * 7);
    points.push({ week: w, weightKg: Math.max(profile.targetWeightKg, profile.weightKg - perWeek * w), date });
  }
  return points;
}

export function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
