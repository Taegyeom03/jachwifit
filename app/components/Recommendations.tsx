"use client";

import { useEffect } from "react";
import { NUTRITION_DATE, PRICE_DATE, isTemporary, nutritionLabel, priceLabel, type Food } from "@/lib/foods";
import { recommend, type Combo } from "@/lib/recommend";
import type { RecStat } from "@/lib/store";

// 100원 단위로 반올림
const won = (n: number) => `${(Math.round(n / 100) * 100).toLocaleString("ko-KR")}원`;

type Props = {
  proteinGap: number;
  kcalLeft: number;
  allowCheat?: boolean; // 치팅데이
  onStat?: (stat: RecStat) => void; // 성공 지표 측정용으로 지금 보여 주는 추천 결과를 알린다
};

// 기능 2. 부족한 단백질을 남은 칼로리 안에서 가장 싸게 채우는 조합
export default function Recommendations({ proteinGap, kcalLeft, allowCheat, onStat }: Props) {
  const combos = proteinGap > 0 && kcalLeft > 0 ? recommend({ proteinGap, kcalLeft, allowCheat }) : [];
  const stat: RecStat =
    proteinGap <= 0
      ? { status: "met" }
      : kcalLeft <= 0
        ? { status: "noKcal" }
        : {
            status: "shown",
            coverage: Math.round((combos[0]?.coverage ?? 0) * 1000) / 1000,
            over: combos.filter((c) => c.kcal > kcalLeft).length,
          };
  const statKey = JSON.stringify(stat);

  useEffect(() => {
    // onStat은 렌더마다 새로 만들어지므로 결과가 바뀔 때만 알린다
    onStat?.(JSON.parse(statKey));
  }, [statKey]);

  if (proteinGap <= 0) {
    return <p className="panel ok">오늘 단백질 목표를 채웠어요.</p>;
  }
  if (kcalLeft <= 0) {
    return (
      <p className="panel warning">
        남은 칼로리가 없어서 추천할 수 있는 음식이 없어요. 오늘은 물이나 무가당 차를 드세요.
      </p>
    );
  }

  if (!combos.length) {
    return <p className="panel muted">남은 칼로리({Math.round(kcalLeft)}kcal) 안에서 고를 수 있는 단백질 음식이 없어요.</p>;
  }

  return (
    <section>
      <h2>
        단백질 {Math.round(proteinGap)}g 채우기 <span className="muted small">남은 칼로리 {Math.round(kcalLeft)}kcal 안에서</span>
      </h2>
      {allowCheat && <p className="muted small">치팅데이라 치킨 · 족발 같은 메뉴도 후보에 넣었어요.</p>}
      <ComboCards combos={combos} />
      <SourceNote />
    </section>
  );
}

export function ComboCards({ combos }: { combos: Combo[] }) {
  return (
    <div className="combos">
      {combos.map((c, i) => (
        <article key={i} className="panel combo">
          <p className="combo-title">
            {c.items.map((it) => `${it.food.name} ${it.servings === 1 ? "" : `×${it.servings}`}`.trim()).join(" + ")}
          </p>
          <p className="combo-sum">
            단백질 <b>{Math.round(c.protein)}g</b> · {Math.round(c.kcal)}kcal · 약 <b>{won(c.price)}</b>
          </p>
          <p className="muted small">부족분의 {Math.round(c.coverage * 100)}% 채움</p>
          <ul className="combo-items">
            {c.items.map((it) => (
              <FoodLine key={it.food.id} food={it.food} servings={it.servings} />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

// 음식 한 줄: 양 · 단백질 · 칼로리 · 가격 + 출처
export function FoodLine({ food, servings }: { food: Food; servings: number }) {
  return (
    <li title={`영양: ${food.nutritionSource}\n가격: ${food.priceSource} (${food.priceDate})`}>
      {food.name} {food.servingLabel} × {servings}: 단백질 {Math.round(food.protein * servings * 10) / 10}g ·{" "}
      {Math.round(food.kcal * servings)}kcal · {(food.price * servings).toLocaleString("ko-KR")}원
      <span className={`source${isTemporary(food.priceSource) || isTemporary(food.nutritionSource) ? " temp" : ""}`}>
        {nutritionLabel(food)} · {priceLabel(food)}
      </span>
    </li>
  );
}

export function SourceNote() {
  return (
    <p className="muted small">
      영양: 식품의약품안전처 전국통합식품영양성분정보({NUTRITION_DATE} 기준). 가격: KAMIS 서울 소매가격 · 한국소비자원
      생필품 가격(참가격), 최근 {PRICE_DATE}. 공공데이터에 없는 음식은 임시값으로 표시했어요.
    </p>
  );
}
