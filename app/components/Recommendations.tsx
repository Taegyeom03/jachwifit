import { NUTRITION_DATE, PRICE_DATE, isTemporary } from "@/lib/foods";
import { recommend } from "@/lib/recommend";

function tempLabel(nutritionSource: string, priceSource: string) {
  const temp = [isTemporary(nutritionSource) && "영양", isTemporary(priceSource) && "가격"].filter(Boolean);
  return temp.length ? ` (${temp.join(" · ")} 임시값)` : "";
}

// 100원 단위로 반올림
const won = (n: number) => `${(Math.round(n / 100) * 100).toLocaleString("ko-KR")}원`;

// 기능 2. 부족한 단백질을 남은 칼로리 안에서 가장 싸게 채우는 조합
export default function Recommendations({ proteinGap, kcalLeft }: { proteinGap: number; kcalLeft: number }) {
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

  const combos = recommend({ proteinGap, kcalLeft });
  if (!combos.length) {
    return <p className="panel muted">남은 칼로리({Math.round(kcalLeft)}kcal) 안에서 고를 수 있는 단백질 음식이 없어요.</p>;
  }

  return (
    <section>
      <h2>
        단백질 {Math.round(proteinGap)}g 채우기 <span className="muted small">남은 칼로리 {Math.round(kcalLeft)}kcal 안에서</span>
      </h2>
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
                <li key={it.food.id} title={`영양: ${it.food.nutritionSource}\n가격: ${it.food.priceSource} (${it.food.priceDate})`}>
                  {it.food.name} {it.food.servingLabel} × {it.servings}: 단백질{" "}
                  {Math.round(it.food.protein * it.servings * 10) / 10}g · {Math.round(it.food.kcal * it.servings)}kcal ·{" "}
                  {(it.food.price * it.servings).toLocaleString("ko-KR")}원
                  {tempLabel(it.food.nutritionSource, it.food.priceSource)}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="muted small">
        영양: 식품의약품안전처 전국통합식품영양성분정보({NUTRITION_DATE} 기준). 가격: KAMIS 서울 소매가격 · 한국소비자원
        생필품 가격(참가격), 최근 {PRICE_DATE}. 공공데이터에 없는 음식은 임시값으로 표시했어요.
      </p>
    </section>
  );
}
