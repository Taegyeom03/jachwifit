// F4. 부족한 단백질을 남은 칼로리 안에서 가장 싸게 채우는 조합 추천
// MVP 알고리즘: 단백질/가격 효율 순 그리디. 시작 음식을 바꿔 가며 서로 다른 조합 3개를 만든다.
import { FOODS, type Food } from "./foods";

export type ComboItem = { food: Food; servings: number };

export type Combo = {
  items: ComboItem[];
  kcal: number;
  protein: number;
  price: number;
  coverage: number; // 단백질 부족분 대비 충족 비율 (0~1)
};

const MIN_PROTEIN_PER_KCAL = 0.07;

type Options = {
  proteinGap: number;
  kcalLeft: number;
  includeTags?: string[]; // 하나라도 있는 음식만 (예: 야식)
  maxItems?: number;
  maxServingsEach?: number;
};

export function recommend({
  proteinGap,
  kcalLeft,
  includeTags,
  maxItems = 3,
  maxServingsEach = 2,
}: Options): Combo[] {
  if (proteinGap <= 0 || kcalLeft <= 0) return [];

  const usable = FOODS.filter(
    (f) =>
      f.protein >= 3 &&
      f.price > 0 &&
      f.kcal > 0 &&
      f.kcal <= kcalLeft &&
      !f.tags.includes("치팅") &&
      (!includeTags || f.tags.some((t) => includeTags.includes(t))),
  );
  // 싸도 단백질이 적은 음식(땅콩버터 · 오트밀 등)은 칼로리만 쓰므로, 100kcal당 단백질 7g 이상을 먼저 쓴다
  const dense = usable.filter((f) => f.protein / f.kcal >= MIN_PROTEIN_PER_KCAL);
  const candidates = (dense.length ? dense : usable).sort((a, b) => b.protein / b.price - a.protein / a.price);

  const combos: Combo[] = [];
  const seen = new Set<string>();

  for (const seed of candidates) {
    if (combos.length >= 3) break;
    const combo = buildCombo(
      [seed, ...candidates.filter((f) => f !== seed)],
      proteinGap,
      kcalLeft,
      maxItems,
      maxServingsEach,
    );
    if (!combo) continue;
    const key = combo.items
      .map((i) => `${i.food.id}x${i.servings}`)
      .sort()
      .join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push(combo);
  }

  // 단백질을 더 많이 채우는 순, 같으면 싼 순
  return combos.sort((a, b) => b.coverage - a.coverage || a.price - b.price);
}

function buildCombo(
  pool: Food[],
  proteinGap: number,
  kcalLeft: number,
  maxItems: number,
  maxServingsEach: number,
): Combo | null {
  const items: ComboItem[] = [];
  let kcal = 0;
  let protein = 0;
  let price = 0;

  for (const food of pool) {
    if (protein >= proteinGap || items.length >= maxItems) break;
    let servings = 0;
    while (servings < maxServingsEach && protein < proteinGap && kcal + food.kcal <= kcalLeft) {
      servings++;
      kcal += food.kcal;
      protein += food.protein;
      price += food.price;
    }
    if (servings > 0) items.push({ food, servings });
  }

  if (!items.length) return null;

  // 부족분을 넘게 채웠으면, 단백질 대비 비싼 음식부터 덜어내도 부족분을 채우는 동안 덜어낸다
  if (protein >= proteinGap) {
    const byCost = [...items].sort((a, b) => b.food.price / b.food.protein - a.food.price / a.food.protein);
    for (const item of byCost) {
      while (item.servings > 0 && protein - item.food.protein >= proteinGap) {
        item.servings--;
        kcal -= item.food.kcal;
        protein -= item.food.protein;
        price -= item.food.price;
      }
    }
  }

  const kept = items.filter((i) => i.servings > 0);
  return { items: kept, kcal, protein, price, coverage: Math.min(1, protein / proteinGap) };
}
