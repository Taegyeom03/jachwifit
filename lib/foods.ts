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
export const MY_PRICE_SOURCE = "내가 입력";
export const isMyPrice = (source: string) => source.startsWith(MY_PRICE_SOURCE);
// 공공데이터 가격인지 (임시값도, 내가 입력한 값도 아님)
export const isPublicPrice = (f: Food) => !isTemporary(f.priceSource) && !isMyPrice(f.priceSource);

// 화면에 보여 줄 짧은 출처 (foods.csv의 긴 출처 문장에서 만든다)
export function nutritionLabel(f: Food): string {
  const s = f.nutritionSource;
  if (isTemporary(s)) return "영양 임시값";
  if (s.startsWith("원재료성식품")) return "영양 국가표준식품성분표";
  const median = s.match(/^가공식품 (\d+)개 중앙값/);
  if (median) return `영양 식약처 가공식품 ${median[1]}개 중앙값`;
  if (s.startsWith("음식")) return "영양 식약처 음식 DB";
  const api = s.match(/^식품영양성분DB API (\d+)개 중앙값/);
  if (api) return `영양 식약처 영양성분DB ${api[1]}개 중앙값`;
  if (s.startsWith("식품영양성분DB API")) return "영양 식약처 영양성분DB";
  return `영양 ${s}`;
}

export function priceLabel(f: Food): string {
  const s = f.priceSource;
  if (isTemporary(s)) return "가격 임시값";
  if (isMyPrice(s)) return `가격 내가 입력 (${f.priceDate.slice(5).replace("-", "/")})`;
  if (s.startsWith("KAMIS")) return `가격 KAMIS 서울 소매 (${f.priceDate.slice(5).replace("-", "/")})`;
  const chamga = s.match(/(\d+)건 중앙값/);
  if (s.startsWith("참가격") && chamga) return `가격 참가격 ${chamga[1]}건 중앙값 (${f.priceDate})`;
  return `가격 ${s}`;
}

export const FOODS: Food[] = data;

const byId = new Map(FOODS.map((f) => [f.id, f]));

// 데이터셋 원래 가격 (내 가격을 지우면 이 값으로 되돌린다)
const ORIGINAL_PRICE = new Map(FOODS.map((f) => [f.id, { price: f.price, priceSource: f.priceSource, priceDate: f.priceDate }]));

export function originalPrice(id: number) {
  return ORIGINAL_PRICE.get(id);
}

// 내가 입력한 가격을 음식 데이터에 덮어쓴다. 추천 · 식비 · 식단 예시 · 인사이트가 모두 food.price를 읽으므로 한 곳에서 바꾼다.
// 내 가격이 없는 음식은 데이터셋 원래 값으로 되돌린다.
export function applyMyPrices(prices: Record<string, { price: number; date: string }>): void {
  for (const f of FOODS) {
    const mine = prices[String(f.id)];
    const orig = ORIGINAL_PRICE.get(f.id)!;
    if (mine && mine.price > 0) {
      f.price = mine.price;
      f.priceSource = MY_PRICE_SOURCE;
      f.priceDate = mine.date;
    } else {
      Object.assign(f, orig);
    }
  }
}

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
