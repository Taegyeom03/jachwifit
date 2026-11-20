import data from "./foods.data.json";

export type Food = {
  id: number;
  name: string;
  servingLabel: string;
  servingG: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  price: number; // 1회 제공량 기준 가격(원)
  priceSource: string;
  priceDate: string;
  nutritionSource: string; // 공공데이터 식품코드 또는 "임시값(...)"
  nutritionDate: string;
  tags: string[];
};

export const isTemporary = (source: string) => source.startsWith("임시값");

export const FOODS: Food[] = data;

const byId = new Map(FOODS.map((f) => [f.id, f]));

export function findFood(id: number): Food | undefined {
  return byId.get(id);
}

// 이름에 검색어가 들어간 음식 (공백 무시)
export function searchFoods(query: string, limit = 8): Food[] {
  const q = query.replace(/\s/g, "");
  if (!q) return [];
  return FOODS.filter((f) => f.name.replace(/\s/g, "").includes(q)).slice(0, limit);
}

// 가격 공공데이터 기준일 (가장 최근)
export const PRICE_DATE = FOODS.filter((f) => !isTemporary(f.priceSource)).map((f) => f.priceDate).sort().at(-1) ?? "";
// 영양 정보 공공데이터 기준일 (가장 최근)
export const NUTRITION_DATE = FOODS.map((f) => f.nutritionDate).filter(Boolean).sort().at(-1) ?? "";
