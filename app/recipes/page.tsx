"use client";

import Link from "next/link";
import { useState } from "react";
import { isTemporary } from "@/lib/foods";
import { calcGoal } from "@/lib/goal";
import { dayTotals, kcalLimit } from "@/lib/nutrition";
import { RECIPES, TOOLS, amountLabel, recipeTotals, type Recipe, type Tool } from "@/lib/recipes";
import { MEALS, dateKey, mealByHour, newId, type Meal } from "@/lib/store";
import { useAppData } from "../useAppData";

type Sort = "protein" | "price" | "time";

const SORTS: { key: Sort; label: string }[] = [
  { key: "protein", label: "단백질 많은 순" },
  { key: "price", label: "재료비 싼 순" },
  { key: "time", label: "빨리 되는 순" },
];

const won = (n: number) => `${(Math.round(n / 10) * 10).toLocaleString("ko-KR")}원`;

// F8. 간단 레시피: 전자레인지 · 프라이팬으로 만드는 고단백 레시피, 재료를 오늘 기록에 바로 추가
export default function RecipesPage() {
  const { ready, profile, logs, updateDay } = useAppData();
  const [tool, setTool] = useState<Tool | "전체">("전체");
  const [sort, setSort] = useState<Sort>("protein");
  const [fitsOnly, setFitsOnly] = useState(false);
  const [added, setAdded] = useState("");

  if (!ready) return <p className="muted">불러오는 중…</p>;

  const todayKey = dateKey(new Date());
  const goal = profile ? calcGoal(profile) : null;
  const kcalLeft = goal ? kcalLimit(goal, logs[todayKey]) - dayTotals(logs[todayKey]).kcal : null;

  const list = RECIPES.map((recipe) => ({ recipe, totals: recipeTotals(recipe) }))
    .filter(({ recipe }) => tool === "전체" || recipe.tool === tool)
    .filter(({ totals }) => !fitsOnly || kcalLeft == null || totals.kcal <= kcalLeft)
    .sort((a, b) =>
      sort === "price"
        ? a.totals.price - b.totals.price
        : sort === "time"
          ? a.recipe.minutes - b.recipe.minutes || b.totals.protein - a.totals.protein
          : b.totals.protein - a.totals.protein,
    );

  function addToToday(recipe: Recipe, meal: Meal) {
    updateDay(todayKey, (d) => ({
      ...d,
      entries: [
        ...d.entries,
        ...recipe.ingredients.map((i) => ({ id: newId(), foodId: i.food.id, amount: i.amount, unit: "serving" as const, meal })),
      ],
    }));
    setAdded(`${recipe.name} 재료 ${recipe.ingredients.length}개를 오늘 ${meal}에 기록했어요.`);
  }

  return (
    <>
      <h1>간단 레시피</h1>
      <p className="muted">
        전자레인지 · 프라이팬만 있으면 되는 고단백 레시피예요. 칼로리 · 단백질 · 재료비는 음식 데이터로 계산하고, [오늘
        기록에 추가]를 누르면 재료가 그대로 기록돼요.
      </p>

      {added && (
        <p className="panel ok" role="status">
          {added} <Link href="/">오늘 화면 보기 →</Link>
        </p>
      )}

      <div className="panel recipe-filters">
        <div className="tabs" role="tablist" aria-label="조리 도구">
          {(["전체", ...TOOLS] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tool === t}
              className={tool === t ? "active" : ""}
              onClick={() => setTool(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="recipe-filter-row">
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {kcalLeft != null && (
            <label className="check">
              <input type="checkbox" checked={fitsOnly} onChange={(e) => setFitsOnly(e.target.checked)} />
              오늘 남은 칼로리({Math.max(0, Math.round(kcalLeft))}kcal) 안에서만
            </label>
          )}
        </div>
      </div>

      {list.length ? (
        <div className="recipes">
          {list.map(({ recipe, totals }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              totals={totals}
              fits={kcalLeft == null ? null : totals.kcal <= kcalLeft}
              onAdd={profile ? addToToday : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="panel muted">조건에 맞는 레시피가 없어요.</p>
      )}

      <p className="muted small">
        식용유 · 소금 · 후추는 칼로리 · 재료비에 넣지 않았어요. 식용유 1작은술은 약 40kcal예요. 재료비는 1인분에 쓰는
        양만큼의 가격이고, [가격] 메뉴에서 입력한 내 가격이 있으면 그 가격으로 계산해요.
      </p>
    </>
  );
}

function RecipeCard({
  recipe,
  totals,
  fits,
  onAdd,
}: {
  recipe: Recipe;
  totals: ReturnType<typeof recipeTotals>;
  fits: boolean | null;
  onAdd?: (recipe: Recipe, meal: Meal) => void;
}) {
  const [meal, setMeal] = useState<Meal>(() => mealByHour(new Date().getHours()));
  const tempPrice = recipe.ingredients.some((i) => isTemporary(i.food.priceSource));

  return (
    <article className="panel recipe">
      <div className="recipe-head">
        <h2>{recipe.name}</h2>
        <span className="recipe-meta">
          {recipe.tool} · {recipe.minutes}분
        </span>
      </div>
      <p className="combo-sum">
        단백질 <b>{Math.round(totals.protein)}g</b> · {Math.round(totals.kcal)}kcal · 재료비 약 <b>{won(totals.price)}</b>
        {fits != null && <span className={`fit${fits ? "" : " no"}`}>{fits ? "남은 칼로리 안" : "남은 칼로리 초과"}</span>}
      </p>

      <h3 className="sub">재료 (1인분)</h3>
      <ul className="recipe-ingredients">
        {recipe.ingredients.map(({ food, amount }) => (
          <li key={food.id}>
            {food.name} <span className="muted">{amountLabel(food, amount)}</span>
          </li>
        ))}
        {recipe.oil && <li className="muted">식용유 조금</li>}
      </ul>
      {tempPrice && <p className="source temp">일부 재료 가격은 임시값이에요.</p>}

      <details>
        <summary>만드는 법 보기</summary>
        <ol className="recipe-steps">
          {recipe.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {recipe.note && <p className="warning">{recipe.note}</p>}
      </details>

      {onAdd ? (
        <div className="recipe-add">
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} aria-label={`${recipe.name} 끼니`}>
            {MEALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <button type="button" className="primary" onClick={() => onAdd(recipe, meal)}>
            오늘 기록에 추가
          </button>
        </div>
      ) : (
        <p className="muted small">
          <Link href="/setup">목표를 설정</Link>하면 레시피를 바로 기록할 수 있어요.
        </p>
      )}
    </article>
  );
}
