// F8. 간단 레시피: 데이터셋 음식을 재료로 쓰고, 칼로리 · 단백질 · 재료비는 그 음식 값으로 계산한다.
// 재료 가격은 food.price를 그대로 읽으므로 "내 가격"을 입력하면 레시피 재료비에도 반영된다.
import data from "@/data/recipes.json";
import { FOODS, type Food } from "./foods";

export const TOOLS = ["전자레인지", "프라이팬", "불 없이", "냄비"] as const;
export type Tool = (typeof TOOLS)[number];

type RecipeData = {
  id: string;
  name: string;
  tool: string;
  minutes: number;
  oil?: boolean; // 식용유를 쓰는지 (칼로리 · 재료비에는 넣지 않음)
  note?: string;
  ingredients: { food: string; amount: number }[]; // amount: 1회 제공량의 몇 배
  steps: string[];
};

export type Recipe = Omit<RecipeData, "ingredients" | "tool"> & {
  tool: Tool;
  ingredients: { food: Food; amount: number }[];
};

export type RecipeTotals = { kcal: number; protein: number; carb: number; fat: number; price: number };

const byName = new Map(FOODS.map((f) => [f.name, f]));

// 재료 이름이 음식 데이터에 없으면 그 레시피는 빼고 개발 중에 알린다
export const RECIPES: Recipe[] = (data as RecipeData[]).flatMap((r) => {
  const ingredients = r.ingredients.map((i) => ({ food: byName.get(i.food), amount: i.amount }));
  const missing = r.ingredients.filter((_, k) => !ingredients[k].food).map((i) => i.food);
  if (missing.length || !(TOOLS as readonly string[]).includes(r.tool)) {
    if (process.env.NODE_ENV !== "production") console.warn(`레시피 ${r.name}: 없는 재료 ${missing.join(", ")}`);
    return [];
  }
  return [{ ...r, tool: r.tool as Tool, ingredients: ingredients as { food: Food; amount: number }[] }];
});

export function recipeTotals(r: Recipe): RecipeTotals {
  const t = { kcal: 0, protein: 0, carb: 0, fat: 0, price: 0 };
  for (const { food, amount } of r.ingredients) {
    t.kcal += food.kcal * amount;
    t.protein += food.protein * amount;
    t.carb += food.carb * amount;
    t.fat += food.fat * amount;
    t.price += food.price * amount;
  }
  return t;
}

// 레시피에 쓰인 음식이 들어간 레시피 (추천 음식 → 레시피 연결용)
export function recipesWithFood(foodId: number): Recipe[] {
  return RECIPES.filter((r) => r.ingredients.some((i) => i.food.id === foodId));
}

// 남은 칼로리 안에서 만들 수 있는 레시피, 단백질 많은 순
export function recipesWithin(kcalLeft: number, limit = 3): { recipe: Recipe; totals: RecipeTotals }[] {
  return RECIPES.map((recipe) => ({ recipe, totals: recipeTotals(recipe) }))
    .filter(({ totals }) => totals.kcal <= kcalLeft)
    .sort((a, b) => b.totals.protein - a.totals.protein || a.totals.price - b.totals.price)
    .slice(0, limit);
}

// 재료 양 표시를 바로 읽히게: 계란 "2개", 간장 "1.5큰술(23ml)", 양배추 "150g", 양파(1/2개(100g) × 0.5) "50g"
export function amountLabel(food: Food, amount: number): string {
  if (amount === 1) return food.servingLabel;
  const n = Math.round(amount * 100) / 100;
  const m = food.servingLabel.match(/^1([가-힣]+)(?:\((\d+(?:\.\d+)?)(g|ml)\))?$/);
  const unit = /ml/.test(food.servingLabel) ? "ml" : "g";
  const total = `${Math.round(food.servingG * amount)}${unit}`;
  if (!m || m[1] === "회" || m[1] === "인분") return total; // "1회(100g)"처럼 양이 g로 정해진 음식
  return m[2] ? `${n}${m[1]}(${total})` : `${n}${m[1]}`;
}
