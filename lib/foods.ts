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
  tags: string[];
};

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

// 가격 정보가 임시값인지 (공공데이터로 교체 전)
export const PRICE_IS_TEMPORARY = FOODS.some((f) => f.priceSource === "임시값");
export const PRICE_DATE = FOODS[0]?.priceDate ?? "";
