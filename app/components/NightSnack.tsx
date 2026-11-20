"use client";

import { lightSnacks, recommend } from "@/lib/recommend";
import { ComboCards, FoodLine } from "./Recommendations";

// 바로 먹을 수 있는 야식 · 편의점 음식을 먼저 고르고, 없을 때만 간단조리까지 넓힌다
const SNACK_TAGS = ["야식", "편의점"];
const WIDER_TAGS = [...SNACK_TAGS, "간단조리"];
// 남은 칼로리가 이보다 적으면 초저칼로리 메뉴만 안내
const VERY_LOW_KCAL = 100;

// 야식 추천: 남은 칼로리 안에서 야식 · 편의점 · 간단조리 음식만 고른다
export default function NightSnack({ proteinGap, kcalLeft }: { proteinGap: number; kcalLeft: number }) {
  if (kcalLeft < VERY_LOW_KCAL) {
    const tiny = lightSnacks(60, [...SNACK_TAGS, "원재료"], 5);
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
    let combos = recommend({ proteinGap, kcalLeft, includeTags: SNACK_TAGS, maxItems: 2 });
    const wider = !combos.length;
    if (wider) combos = recommend({ proteinGap, kcalLeft, includeTags: WIDER_TAGS, maxItems: 2 });
    if (combos.length) {
      return (
        <section className="panel night">
          <h3>야식으로 단백질 채우기</h3>
          <p className="muted small">
            {wider ? "야식 · 편의점 · 간단조리" : "야식 · 편의점"} 메뉴만 골랐어요. 남은 칼로리 {Math.round(kcalLeft)}kcal 안이에요.
          </p>
          <ComboCards combos={combos} />
        </section>
      );
    }
  }

  const snacks = lightSnacks(kcalLeft, WIDER_TAGS, 5);
  return (
    <section className="panel night">
      <h3>남은 칼로리 안에서 먹을 수 있는 야식</h3>
      <p className="muted small">단백질이 많은 순서예요. 남은 칼로리 {Math.round(kcalLeft)}kcal 안이에요.</p>
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
