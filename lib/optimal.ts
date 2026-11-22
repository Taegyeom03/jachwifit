// 추천 최적해(비교 실험용): 그리디와 같은 후보 · 같은 제약에서 가능한 조합을 모두 따져
// ① 단백질 부족분을 가장 많이 채우고 ② 그중 가장 싼 조합을 찾는다.
// 제약: 음식 최대 maxItems가지, 음식마다 1~maxServingsEach회분, 합계 칼로리 ≤ kcalLeft.
// 앱 추천에는 쓰지 않는다 (경우의 수가 많아 느림). 그리디가 얼마나 최적에 가까운지 재는 기준이다.
import type { Food } from "./foods";
import type { Combo } from "./recommend";

const EPS = 1e-9;

export function optimalCombo(
  candidates: Food[],
  proteinGap: number,
  kcalLeft: number,
  maxItems = 3,
  maxServingsEach = 2,
): Combo | null {
  if (proteinGap <= 0 || kcalLeft <= 0) return null;
  let best: { cov: number; price: number; picks: [Food, number][] } | null = null;
  const picks: [Food, number][] = [];

  const consider = (kcal: number, protein: number, price: number) => {
    const cov = Math.min(1, protein / proteinGap);
    if (!best || cov > best.cov + EPS || (Math.abs(cov - best.cov) <= EPS && price < best.price - EPS)) {
      best = { cov, price, picks: picks.map(([f, s]) => [f, s]) };
    }
  };

  // start 이후 음식 중에서 하나 더 고르기 (깊이 = 고른 음식 수)
  const search = (start: number, kcal: number, protein: number, price: number) => {
    if (picks.length) consider(kcal, protein, price);
    if (picks.length >= maxItems) return;
    for (let i = start; i < candidates.length; i++) {
      const f = candidates[i];
      for (let s = 1; s <= maxServingsEach; s++) {
        const k = kcal + f.kcal * s;
        if (k > kcalLeft + EPS) break;
        picks.push([f, s]);
        search(i + 1, k, protein + f.protein * s, price + f.price * s);
        picks.pop();
      }
    }
  };
  search(0, 0, 0, 0);

  if (!best) return null;
  const b = best as { cov: number; price: number; picks: [Food, number][] };
  const items = b.picks.map(([food, servings]) => ({ food, servings }));
  const sum = (key: "kcal" | "protein" | "price") => items.reduce((acc, it) => acc + it.food[key] * it.servings, 0);
  return { items, kcal: sum("kcal"), protein: sum("protein"), price: sum("price"), coverage: b.cov };
}
