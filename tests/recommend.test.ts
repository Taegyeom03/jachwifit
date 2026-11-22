// 최저가 단백질 추천(lib/recommend.ts) 단위 테스트: 추천은 남은 칼로리를 절대 넘지 않아야 한다 (PRD 성공 지표)
import { describe, expect, it } from "vitest";
import { recommend } from "@/lib/recommend";

describe("recommend", () => {
  it("단백질이 부족하지 않거나 남은 칼로리가 없으면 추천하지 않는다", () => {
    expect(recommend({ proteinGap: 0, kcalLeft: 1000 })).toEqual([]);
    expect(recommend({ proteinGap: 50, kcalLeft: 0 })).toEqual([]);
    expect(recommend({ proteinGap: 50, kcalLeft: -100 })).toEqual([]);
  });

  it("여러 상황에서 어떤 조합도 남은 칼로리를 넘지 않는다", () => {
    for (const kcalLeft of [80, 150, 300, 600, 1200, 2000]) {
      for (const proteinGap of [5, 30, 80, 150]) {
        for (const c of recommend({ proteinGap, kcalLeft })) {
          expect(c.kcal).toBeLessThanOrEqual(kcalLeft + 1e-9);
        }
      }
    }
  });

  it("조합은 최대 3개, 음식 수 · 1회 제공량 수 제한을 지킨다", () => {
    const combos = recommend({ proteinGap: 100, kcalLeft: 1500, maxItems: 3, maxServingsEach: 2 });
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.length).toBeLessThanOrEqual(3);
    for (const c of combos) {
      expect(c.items.length).toBeLessThanOrEqual(3);
      for (const it of c.items) expect(it.servings).toBeLessThanOrEqual(2);
    }
  });

  it("합계(칼로리 · 단백질 · 가격)가 음식별 합과 같다", () => {
    for (const c of recommend({ proteinGap: 60, kcalLeft: 900 })) {
      const sum = (k: "kcal" | "protein" | "price") => c.items.reduce((s, it) => s + it.food[k] * it.servings, 0);
      expect(c.kcal).toBeCloseTo(sum("kcal"), 6);
      expect(c.protein).toBeCloseTo(sum("protein"), 6);
      expect(c.price).toBeCloseTo(sum("price"), 6);
      expect(c.coverage).toBeLessThanOrEqual(1);
    }
  });

  it("치팅데이가 아니면 '치팅' 음식을 추천하지 않는다", () => {
    for (const c of recommend({ proteinGap: 80, kcalLeft: 2000 })) {
      for (const it of c.items) expect(it.food.tags).not.toContain("치팅");
    }
  });

  it("야식 모드는 야식 태그 음식만 쓴다", () => {
    for (const c of recommend({ proteinGap: 40, kcalLeft: 700, includeTags: ["야식"] })) {
      for (const it of c.items) expect(it.food.tags).toContain("야식");
    }
  });
});
