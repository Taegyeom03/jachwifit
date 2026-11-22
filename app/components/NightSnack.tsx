"use client";

import { lightSnacks, recommend, type Combo } from "@/lib/recommend";
import { ComboCards, FoodLine } from "./Recommendations";

// 야식은 어디서 구하느냐로 나눠서, 곳마다 추천 1등 조합(단백질을 가장 많이 채우고, 같으면 더 싼 것)을 하나씩 보여 준다
const PLACES = [
  { label: "🏪 편의점", tags: ["편의점"], maxItems: 2, maxServingsEach: 2 },
  // 배달 · 외식은 메뉴 하나 1인분이 현실적 (찌개 두 그릇씩 시키지 않음)
  { label: "🛵 배달 · 외식", tags: ["외식"], maxItems: 1, maxServingsEach: 1 },
  { label: "🍳 집에서 간단히", tags: ["간단조리", "원재료"], maxItems: 2, maxServingsEach: 2 },
];
const ALL_TAGS = [...new Set(PLACES.flatMap((p) => p.tags).concat("야식"))];
// 남은 칼로리가 이보다 적으면 초저칼로리 메뉴만 안내
const VERY_LOW_KCAL = 100;

type Props = { proteinGap: number; kcalLeft: number; allowCheat?: boolean };

// 야식 추천: 남은 칼로리 안에서 편의점 · 배달/외식 · 집에서 먹을 수 있는 것으로 단백질 채우기
export default function NightSnack({ proteinGap, kcalLeft, allowCheat = false }: Props) {
  if (kcalLeft < VERY_LOW_KCAL) {
    const tiny = lightSnacks(60, ALL_TAGS, 5);
    return (
      <section className="panel night">
        <h3>야식</h3>
        <p>
          남은 칼로리가 {Math.max(0, Math.round(kcalLeft))}kcal뿐이에요. 꼭 먹고 싶다면 아주 가벼운 것으로 드세요. 넘친 만큼은
          이번 주 남은 날에 조금씩 나눠 줄이면 돼요.
        </p>
        <ul className="combo-items">
          {tiny.map((f) => (
            <FoodLine key={f.id} food={f} servings={1} />
          ))}
        </ul>
      </section>
    );
  }

  if (proteinGap > 0) {
    const picks: { label: string; combo: Combo }[] = [];
    for (const place of PLACES) {
      const { tags, maxItems, maxServingsEach } = place;
      const combo = recommend({ proteinGap, kcalLeft, includeTags: tags, allowCheat, maxItems, maxServingsEach })[0];
      if (combo) picks.push({ label: place.label, combo });
    }
    if (picks.length) {
      return (
        <section className="panel night">
          <h3>야식으로 단백질 채우기</h3>
          <p className="muted small">
            편의점 · 배달/외식 · 집에서, 곳마다 단백질을 가장 많이 채우는 조합이에요(같으면 더 싼 것). 남은 칼로리 {Math.round(kcalLeft)}kcal 안이에요.
            {allowCheat ? " 치팅데이라 치킨 · 족발 같은 메뉴도 넣었어요." : ""}
          </p>
          <ComboCards combos={picks.map((p) => p.combo)} labels={picks.map((p) => p.label)} />
        </section>
      );
    }
  }

  const snacks = lightSnacks(kcalLeft, ALL_TAGS, 5);
  return (
    <section className="panel night">
      <h3>남은 칼로리 안에서 먹을 수 있는 야식</h3>
      <p className="muted small">편의점 · 배달/외식 · 집에서 먹을 수 있는 것 중 단백질이 많은 순서예요. 남은 칼로리 {Math.round(kcalLeft)}kcal 안이에요.</p>
      {snacks.length ? (
        <ul className="combo-items">
          {snacks.map((f) => (
            <FoodLine key={f.id} food={f} servings={1} />
          ))}
        </ul>
      ) : (
        <p className="muted">남은 칼로리 안에서 고를 수 있는 야식이 없어요.</p>
      )}
    </section>
  );
}
