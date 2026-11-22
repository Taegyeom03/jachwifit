// 최적해(lib/optimal.ts) 단위 테스트: 제약을 지키고, 그리디보다 나쁘지 않아야 한다
import { describe, expect, it } from "vitest";
import { optimalCombo } from "@/lib/optimal";
import { candidateFoods, recommend } from "@/lib/recommend";

const cases: [number, number][] = [
  [30, 300],
  [60, 600],
  [100, 1200],
];

describe("optimalCombo", () => {
  it.each(cases)("단백질 %ig 부족 · %ikcal 남음: 칼로리 · 개수 제약을 지킨다", (gap, kcal) => {
    const c = optimalCombo(candidateFoods({ kcalLeft: kcal }), gap, kcal)!;
    expect(c.kcal).toBeLessThanOrEqual(kcal + 1e-9);
    expect(c.items.length).toBeLessThanOrEqual(3);
    for (const it of c.items) expect(it.servings).toBeLessThanOrEqual(2);
  });

  it.each(cases)("단백질 %ig 부족 · %ikcal 남음: 그리디 1등보다 덜 채우거나 더 비싸지 않다", (gap, kcal) => {
    const opt = optimalCombo(candidateFoods({ kcalLeft: kcal }), gap, kcal)!;
    const greedy = recommend({ proteinGap: gap, kcalLeft: kcal })[0];
    expect(opt.coverage).toBeGreaterThanOrEqual(greedy.coverage - 1e-9);
    if (Math.abs(opt.coverage - greedy.coverage) < 1e-9) expect(opt.price).toBeLessThanOrEqual(greedy.price + 1e-9);
  });

  it("부족분이 없거나 칼로리가 없으면 null", () => {
    expect(optimalCombo(candidateFoods({ kcalLeft: 500 }), 0, 500)).toBeNull();
    expect(optimalCombo(candidateFoods({ kcalLeft: 0 }), 30, 0)).toBeNull();
  });
});
