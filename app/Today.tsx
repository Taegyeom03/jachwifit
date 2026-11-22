"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findFood } from "@/lib/foods";
import { calcGoal } from "@/lib/goal";
import { dayTotals, entryTotals, kcalLimit, weekBudget } from "@/lib/nutrition";
import { recipesWithin } from "@/lib/recipes";
import { copyEntries, frequentFoods, previousLoggedDay } from "@/lib/quickLog";
import { MEALS, dateKey, isValidDayKey, mealByHour, newId } from "@/lib/store";
import AiMealInput from "./components/AiMealInput";
import WeightInput from "./components/WeightInput";
import FoodAdder from "./components/FoodAdder";
import NightSnack from "./components/NightSnack";
import Recommendations from "./components/Recommendations";
import { useAppData } from "./useAppData";


function formatDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

// 기능 1. 목표 대비 식사 기록 + 기능 2. 추천 카드
export default function Today() {
  const params = useSearchParams();
  const { ready, settled, profile, logs, updateDay, setMyPrice, saveError, account } = useAppData();
  const [showSnack, setShowSnack] = useState(false);
  const router = useRouter();

  // 처음 들어온 사람(목표 없음)은 바로 목표 설정으로 보낸다. 계정에서 받아 오는 중이면 기다린다.
  useEffect(() => {
    if (ready && settled && !profile) router.replace("/setup");
  }, [ready, settled, profile, router]);

  const todayKey = dateKey(new Date());
  const requested = params.get("date");
  const key = requested && isValidDayKey(requested) ? requested : todayKey;
  const isToday = key === todayKey;

  if (!ready || (!settled && !profile)) return <p className="muted">불러오는 중…</p>;

  if (!profile) {
    return (
      <section className="panel center">
        <h1>자취핏</h1>
        <p>목표 칼로리와 단백질을 먼저 계산해야 기록을 시작할 수 있어요.</p>
        <Link href="/setup" className="button primary">
          목표 설정하기
        </Link>
      </section>
    );
  }

  const goal = calcGoal(profile);
  const day = logs[key];
  const totals = dayTotals(day);
  const cheat = !!day?.cheat;
  const limit = kcalLimit(goal, day);
  const kcalLeft = limit - totals.kcal;
  const proteinGap = goal.targetProtein - totals.protein;
  const lateEnough = !isToday || new Date().getHours() >= 20;
  const tooLittle = lateEnough && totals.kcal > 0 && totals.kcal < goal.bmr * 0.7;
  const week = isToday ? weekBudget(goal, logs, new Date(), dateKey) : null;
  // 지난 기록 복사: 오늘이 아직 비어 있을 때만 보여 준다 (같은 걸 두 번 넣지 않게)
  const prevKey = !day?.entries.length ? previousLoggedDay(logs, key) : null;

  const bars = [
    { label: "칼로리", unit: "kcal", value: totals.kcal, target: limit, limit: true },
    { label: "단백질", unit: "g", value: totals.protein, target: goal.targetProtein },
    { label: "탄수화물", unit: "g", value: totals.carb, target: goal.targetCarb },
    { label: "지방", unit: "g", value: totals.fat, target: goal.targetFat, limit: true },
    { label: "식이섬유", unit: "g", value: totals.fiber, target: goal.targetFiber },
  ];

  return (
    <>
      <div className="day-head">
        <h1>{isToday ? "오늘" : formatDate(key)}</h1>
        {isToday ? (
          <span className="muted">{formatDate(key)}</span>
        ) : (
          <Link href="/" className="small">
            오늘로 돌아가기
          </Link>
        )}
      </div>

      <label className="check cheat-toggle">
        <input
          type="checkbox"
          checked={cheat}
          onChange={(e) => updateDay(key, (d) => ({ ...d, cheat: e.target.checked || undefined }))}
        />
        {isToday ? "오늘은" : "이 날은"} 치팅데이 ★
      </label>
      {cheat && (
        <p className="panel cheat-note small">
          치팅데이에는 칼로리 상한을 유지 칼로리({Math.round(goal.tdee)}kcal)까지 올려요. 무제한은 아니고, 단백질 목표(
          {Math.round(goal.targetProtein)}g)는 그대로예요.
        </p>
      )}

      <WeightInput
        key={`${key}-${day?.weight ?? ""}`}
        value={day?.weight}
        label={isToday ? "오늘 몸무게" : "이 날 몸무게"}
        onSave={(w) => updateDay(key, (d) => ({ ...d, weight: w ?? undefined }))}
      />

      <section className="panel">
        {bars.map((b) => {
          const pct = Math.min(100, (b.value / b.target) * 100);
          const over = b.limit && b.value > b.target;
          return (
            <div key={b.label} className="bar-row">
              <span className="bar-label">{b.label}</span>
              <div className="bar">
                <div className={`bar-fill${over ? " over" : ""}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="bar-value">
                {Math.round(b.value)} / {Math.round(b.target)}
                {b.unit}
              </span>
            </div>
          );
        })}
        <p className="gap-line">
          {proteinGap > 0 ? (
            <>
              단백질 <b>{Math.round(proteinGap)}g 부족</b>
            </>
          ) : (
            <>단백질 목표 달성</>
          )}
          {" · "}
          {kcalLeft >= 0 ? (
            <>
              남은 칼로리 <b>{Math.round(kcalLeft)}kcal</b>
            </>
          ) : (
            <span className="over-text">칼로리 {Math.round(-kcalLeft)}kcal 초과</span>
          )}
          {" · "}식비 {Math.round(totals.price).toLocaleString("ko-KR")}원
        </p>
        {tooLittle && (
          <p className="warning">
            너무 적게 드셨어요. 기초대사량({Math.round(goal.bmr)}kcal)보다 많이 적게 먹으면 근손실과 폭식으로 이어지기 쉬워요.
          </p>
        )}
      </section>

      {week && week.over > 0 && (
        <section className="panel week-budget">
          <h3>이번 주 칼로리 예산</h3>
          <p>
            이번 주(월~오늘) 목표보다 <b>{Math.round(week.over).toLocaleString("ko-KR")}kcal</b> 더 먹었어요
            {week.cheatDays ? ` (치팅데이 ${week.cheatDays}일 포함)` : ""}.
          </p>
          {week.daysLeft === 0 ? (
            <p className="muted small">오늘이 이번 주 마지막 날이에요. 다음 주는 다시 목표대로 시작하면 돼요.</p>
          ) : (
            <p>
              남은 {week.daysLeft}일 동안 하루 <b>약 {Math.round(week.perDayCut / 10) * 10}kcal</b>씩 줄이면
              {week.fullyRecoverable ? " 이번 주 예산을 맞출 수 있어요." : " 일부를 되돌릴 수 있어요."}
            </p>
          )}
          <p className="muted small">
            매일 목표는 바꾸지 않아요. 굶어서 보상하지 말고, 기초대사량({Math.round(goal.bmr)}kcal) 아래로는 줄이지 마세요.
          </p>
        </section>
      )}

      <AiMealInput
        loggedIn={!!account}
        defaultMeal={isToday ? mealByHour(new Date().getHours()) : "점심"}
        onAdd={(items) =>
          updateDay(key, (d) => ({
            ...d,
            entries: [
              ...d.entries,
              ...items.map((it) => ({ id: newId(), foodId: it.foodId, amount: it.amount, unit: it.unit, meal: it.meal })),
            ],
          }))
        }
      />

      <FoodAdder
        key={key}
        defaultMeal={isToday ? mealByHour(new Date().getHours()) : "점심"}
        onAdd={(foodId, amount, unit, meal) =>
          updateDay(key, (d) => ({ ...d, entries: [...d.entries, { id: newId(), foodId, amount, unit, meal }] }))
        }
        onSavePrice={setMyPrice}
        frequent={frequentFoods(logs, key)}
      />
      {prevKey && (
        <button
          type="button"
          className="button copy-day"
          onClick={() =>
            updateDay(key, (d) => ({ ...d, entries: [...d.entries, ...copyEntries(logs[prevKey], newId)] }))
          }
        >
          📋 {formatDate(prevKey)} 식단 그대로 넣기 ({logs[prevKey].entries.length}개)
        </button>
      )}
      {saveError && <p className="error">이 브라우저에서는 기록을 저장할 수 없어요. 시크릿 모드인지 확인해 주세요.</p>}

      <section className="meals">
        {MEALS.map((meal) => {
          const entries = (day?.entries ?? []).filter((e) => e.meal === meal);
          if (!entries.length) return null;
          return (
            <div key={meal} className="panel meal">
              <h3>{meal}</h3>
              <ul>
                {entries.map((e) => {
                  const food = findFood(e.foodId);
                  const t = entryTotals(e);
                  return (
                    <li key={e.id}>
                      <span>
                        {food?.name ?? "삭제된 음식"}{" "}
                        <span className="muted small">
                          {e.unit === "g" ? `${e.amount}g` : `${food?.servingLabel ?? ""} × ${e.amount}`}
                        </span>
                      </span>
                      <span className="muted small">
                        {t ? `${Math.round(t.kcal)}kcal · 단백질 ${Math.round(t.protein)}g` : ""}
                      </span>
                      <button
                        type="button"
                        className="link danger"
                        aria-label={`${food?.name ?? "음식"} 삭제`}
                        onClick={() =>
                          updateDay(key, (d) => ({ ...d, entries: d.entries.filter((x) => x.id !== e.id) }))
                        }
                      >
                        삭제
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!day?.entries.length && <p className="muted">아직 기록이 없어요. 위에서 먹은 음식을 검색해 추가해 보세요.</p>}
      </section>

      <button type="button" className="snack-btn" onClick={() => setShowSnack((s) => !s)} aria-expanded={showSnack}>
        🌙 {showSnack ? "야식 추천 닫기" : "야식 먹고 싶어"}
      </button>
      {showSnack && <NightSnack proteinGap={proteinGap} kcalLeft={kcalLeft} allowCheat={cheat} />}

      <Recommendations
        proteinGap={proteinGap}
        kcalLeft={kcalLeft}
        allowCheat={cheat}
        onStat={(stat) => {
          // 기록이 있는 날만, 결과가 바뀌었을 때만 저장 (Q6 성공 지표 측정)
          // 계정과 맞추기 전에는 저장하지 않고, 고친 시각도 올리지 않는다 (옛 기록이 계정 기록을 덮지 않게)
          if (!settled || !day?.entries.length || JSON.stringify(day.rec) === JSON.stringify(stat)) return;
          updateDay(key, (d) => ({ ...d, rec: stat }), { silent: true });
        }}
      />

      {isToday && kcalLeft > 0 && <RecipeSuggestions kcalLeft={kcalLeft} />}
    </>
  );
}

// 남은 칼로리 안에서 만들 수 있는 레시피 (단백질 많은 순 2개)
function RecipeSuggestions({ kcalLeft }: { kcalLeft: number }) {
  const picks = recipesWithin(kcalLeft, 2);
  if (!picks.length) return null;
  return (
    <section>
      <h2>
        직접 만들어 먹기 <span className="muted small">남은 칼로리 안의 간단 레시피</span>
      </h2>
      <div className="combos">
        {picks.map(({ recipe, totals }) => (
          <Link key={recipe.id} href="/recipes" className="panel combo recipe-link">
            <p className="combo-title">{recipe.name}</p>
            <p className="combo-sum">
              단백질 <b>{Math.round(totals.protein)}g</b> · {Math.round(totals.kcal)}kcal · 약{" "}
              {(Math.round(totals.price / 100) * 100).toLocaleString("ko-KR")}원
            </p>
            <p className="muted small">
              {recipe.tool} · {recipe.minutes}분
            </p>
          </Link>
        ))}
      </div>
      <p className="muted small">
        <Link href="/recipes">레시피 전체 보기 →</Link>
      </p>
    </section>
  );
}
