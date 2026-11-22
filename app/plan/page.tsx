"use client";

import Link from "next/link";
import { useState } from "react";
import { isTemporary } from "@/lib/foods";
import { calcGoal } from "@/lib/goal";
import { buildDayPlans, formatKoreanDate, plannedWeight, weightPath, weightProgress, type Progress } from "@/lib/plan";
import type { Profile } from "@/lib/goal";
import { FoodLine, SourceNote } from "../components/Recommendations";
import { useAppData } from "../useAppData";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const kg = (n: number) => `${Math.round(n * 10) / 10}kg`;

// 처음 시작 화면 2단계: 목표를 저장한 뒤 "이렇게 먹으면 언제쯤 목표 체중" 계획을 보여 준다
export default function PlanPage() {
  const { ready, profile, logs } = useAppData();
  const [variant, setVariant] = useState(0);
  const [view, setView] = useState<"recent" | "all" | null>(null);

  if (!ready) return <p className="muted">불러오는 중…</p>;
  if (!profile) {
    return (
      <section className="panel center">
        <p>목표를 먼저 설정해 주세요.</p>
        <Link href="/setup" className="button primary">
          목표 설정하기
        </Link>
      </section>
    );
  }

  const goal = calcGoal(profile);
  const progress = weightProgress(profile, goal, logs);
  const path = weightPath(profile, goal, progress.start);
  const end = path[path.length - 1];
  // 기록이 계획 기간의 일부만 차지하면 "최근 기록" 확대 보기를 기본으로
  const canZoom = progress.planDays > 0 && !!progress.latest && progress.latest.day < progress.planDays * 0.6;
  const chartView = canZoom ? (view ?? "recent") : "all";
  const plans = buildDayPlans(goal);
  const plan = plans.length ? plans[variant % plans.length] : null;
  const hasTemp = plan?.meals.some((m) => m.items.some((it) => isTemporary(it.food.priceSource)));

  return (
    <>
      <h1>내 계획</h1>

      <section className="panel plan-hero">
        {end ? (
          <p className="plan-headline">
            하루 <b>{fmt(goal.targetKcal)}kcal</b> · 단백질 <b>{fmt(goal.targetProtein)}g</b>으로 먹으면
            <br />약 <b>{goal.weeks}주</b> 뒤, <b>{formatKoreanDate(end.date)}</b>쯤 <b>{kg(profile.targetWeightKg)}</b>가 됩니다.
          </p>
        ) : (
          <p className="plan-headline">
            목표 체중이 현재 체중 이상이라 감량 기간은 없어요. 하루 <b>{fmt(goal.targetKcal)}kcal</b> · 단백질{" "}
            <b>{fmt(goal.targetProtein)}g</b>을 지켜 보세요.
          </p>
        )}
        <div className="stats">
          <Stat label="지금" value={kg(profile.weightKg)} />
          <Stat label="목표" value={kg(profile.targetWeightKg)} strong />
          <Stat label="예상 감량" value={`주당 ${goal.weeklyLossKg.toFixed(2)}kg`} />
          <Stat label="하루 적자" value={`${fmt(goal.dailyDeficit)}kcal`} />
        </div>
        {goal.warnings.map((w) => (
          <p key={w} className="warning">
            {w}
          </p>
        ))}
      </section>

      {(progress.planDays > 0 || progress.records.length > 0) && (
        <section className="panel">
          <div className="plan-meals-head">
            <h2>계획 vs 실제 몸무게</h2>
            {canZoom && (
              <div className="tabs" role="tablist" aria-label="그래프 범위">
                {(
                  [
                    ["recent", "최근 기록"],
                    ["all", "전체 계획"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={chartView === k}
                    className={chartView === k ? "active" : ""}
                    onClick={() => setView(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ProgressSummary profile={profile} progress={progress} />
          <ProgressChart profile={profile} progress={progress} zoom={chartView === "recent"} />
          <p className="chart-legend small">
            <span>
              <i className="lg-plan" /> 계획
            </span>
            <span>
              <i className="lg-actual" /> 내가 잰 몸무게
            </span>
          </p>
          <p className="muted small">
            계획 선은 {formatKoreanDate(progress.start)}부터 하루 {fmt(goal.dailyDeficit)}kcal 적게 먹으면 7,700kcal당 1kg이
            빠진다고 보고 그렸어요. 몸무게는 물 · 음식에 따라 하루 1kg씩도 오르내리니, 한 번보다 흐름을 보세요.
          </p>
        </section>
      )}

      {plan && (
        <section className="panel">
          <div className="plan-meals-head">
            <h2>하루 식단 예시</h2>
            {plans.length > 1 && (
              <button type="button" className="button" onClick={() => setVariant((v) => v + 1)}>
                다른 예시 보기 ({(variant % plans.length) + 1}/{plans.length})
              </button>
            )}
          </div>
          <p className="combo-sum">
            단백질 <b>{fmt(plan.protein)}g</b> / {fmt(goal.targetProtein)}g · {fmt(plan.kcal)}kcal / {fmt(goal.targetKcal)}kcal
            · 하루 약 <b>{fmt(Math.round(plan.price / 100) * 100)}원</b>
          </p>
          <div className="plan-meals">
            {plan.meals.map((m) => (
              <div key={m.meal} className="plan-meal">
                <h3 className="sub">{m.meal}</h3>
                {m.items.length ? (
                  <ul className="combo-items">
                    {m.items.map((it) => (
                      <FoodLine key={it.food.id} food={it.food} servings={it.servings} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">자유롭게</p>
                )}
              </div>
            ))}
          </div>
          <p className="muted small">
            목표 칼로리 안에서 단백질을 가장 싸게 채우는 조합으로 만든 예시예요. 꼭 이대로 먹을 필요는 없고, 매일 기록하면
            남은 칼로리에 맞춰 다시 추천해 드려요.
            {hasTemp && " 일부 가격은 임시값이에요."}
          </p>
          <SourceNote />
        </section>
      )}

      <div className="plan-actions">
        <Link href="/" className="button primary">
          이대로 시작하기
        </Link>
        <Link href="/setup" className="button">
          목표 바꾸기
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`stat${strong ? " strong" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ProgressSummary({ profile, progress }: { profile: Profile; progress: Progress }) {
  const { latest, diff } = progress;
  if (!latest) {
    return (
      <p className="progress-msg">
        아직 잰 몸무게가 없어요. <Link href="/">오늘 화면</Link>에서 몸무게를 기록하면 계획과 비교해 드려요.
      </p>
    );
  }
  const lost = profile.weightKg - latest.weightKg;
  const d = latest.date.slice(5).replace("-", "/");
  return (
    <p className="progress-msg">
      {d} 기준 <b>{kg(latest.weightKg)}</b> · 시작보다 {lost >= 0 ? `${kg(lost)} 감량` : `${kg(-lost)} 증가`}
      {diff != null && (
        <>
          <br />
          {Math.abs(diff) < 0.3 ? (
            <span className="pace good">계획대로 가고 있어요 👍</span>
          ) : diff < 0 ? (
            <span className="pace good">계획보다 {kg(-diff)} 빨라요 🎉</span>
          ) : (
            <span className="pace slow">계획보다 {kg(diff)} 늦어요. 이번 주 칼로리를 한 번 확인해 보세요.</span>
          )}
        </>
      )}
    </p>
  );
}

// 계획 선(목표 체중까지) 위에 실제로 잰 몸무게를 점 · 선으로 겹쳐 그린다 (SVG, 화면 폭에 맞춰 늘어남)
// zoom: 시작일 ~ 마지막 기록 며칠 뒤까지만 확대해서, 기록이 적을 때도 오르내림이 보이게 한다
function ProgressChart({ profile, progress, zoom }: { profile: Profile; progress: Progress; zoom: boolean }) {
  // 휴대폰 폭(약 310px)에서도 글씨가 11px 이상 보이도록 작은 좌표계를 쓴다
  const W = 360;
  const H = 180;
  const pad = { l: 50, r: 22, t: 18, b: 26 };
  const { planDays, perDay, records, latest, start } = progress;
  const plan = (d: number) => plannedWeight(profile, perDay, d);

  const xMin = 0;
  const xMax = zoom && latest ? Math.max(latest.day + 3, 7) : Math.max(planDays, latest?.day ?? 0, 7);
  // 계획 선: 범위 양 끝 + (범위 안이면) 목표 도달 지점
  const planPts: [number, number][] = planDays
    ? [[xMin, plan(xMin)], ...(planDays < xMax ? [[planDays, profile.targetWeightKg] as [number, number]] : []), [xMax, plan(xMax)]]
    : [];
  const values = [...records.map((r) => r.weightKg), ...planPts.map(([, v]) => v), profile.weightKg];
  const step = zoom ? 0.5 : 1; // 세로 눈금 간격(kg)
  const hi = Math.ceil((Math.max(...values) + step / 2) / step) * step;
  const lo = Math.floor((Math.min(...values) - step / 2) / step) * step;
  const x = (day: number) => pad.l + ((day - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const toLine = (pts: [number, number][]) => pts.map(([d, v]) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  // 세로 눈금: 확대면 0.5~1kg 간격 여러 줄, 전체면 시작 · 목표 체중만
  const yTicks: number[] = [];
  if (zoom) {
    const every = hi - lo > 4 ? 1 : 0.5;
    for (let v = lo; v <= hi + 1e-9; v += every) yTicks.push(Math.round(v * 10) / 10);
  } else {
    yTicks.push(profile.weightKg);
    if (planDays) yTicks.push(profile.targetWeightKg);
  }

  // 가로 눈금: 확대면 날짜(MM/DD, 1주 간격), 전체면 주차
  const xTicks: { day: number; label: string }[] = [];
  if (zoom) {
    for (let d = 0; d <= xMax - 2; d += 7) {
      const date = new Date(start);
      date.setDate(date.getDate() + d);
      xTicks.push({ day: d, label: `${date.getMonth() + 1}/${date.getDate()}` });
    }
  } else {
    const weeks = xMax / 7;
    const every = weeks <= 6 ? 1 : weeks <= 12 ? 2 : weeks <= 24 ? 4 : 8;
    for (let w = 0; w * 7 <= xMax - every * 3.5; w += every) xTicks.push({ day: w * 7, label: w === 0 ? "시작" : `${w}주` });
    xTicks.push({ day: xMax, label: `${Math.round(weeks)}주` });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="weight-chart"
      role="img"
      aria-label={`계획: ${kg(profile.weightKg)}에서 ${kg(profile.targetWeightKg)}까지. 기록 ${records.length}개${latest ? `, 마지막 ${kg(latest.weightKg)}` : ""}`}
    >
      {zoom &&
        yTicks.map((v) => <line key={`g${v}`} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="chart-grid" />)}
      {planDays > 0 && profile.targetWeightKg >= lo && (
        <line x1={pad.l} x2={W - pad.r} y1={y(profile.targetWeightKg)} y2={y(profile.targetWeightKg)} className="chart-goal" />
      )}
      {yTicks.map((v) => (
        <text key={v} x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
          {kg(v)}
        </text>
      ))}
      {xTicks.map((t) => (
        <text key={t.day} x={x(t.day)} y={H - 8} textAnchor="middle" className="chart-label">
          {t.label}
        </text>
      ))}

      {planPts.length > 0 && <polyline points={toLine(planPts)} className="chart-line plan" />}
      {planDays > 0 && planDays <= xMax && (
        <circle cx={x(planDays)} cy={y(profile.targetWeightKg)} r={5} className="chart-dot goal" />
      )}

      {records.length > 1 && <polyline points={toLine(records.map((r) => [r.day, r.weightKg]))} className="chart-actual" />}
      {records.map((r) => (
        <circle key={r.date} cx={x(r.day)} cy={y(r.weightKg)} r={r === latest ? 4.5 : zoom ? 3.5 : 3} className="chart-actual-dot">
          <title>
            {r.date.slice(5).replace("-", "/")} {kg(r.weightKg)} (계획 {kg(plan(r.day))})
          </title>
        </circle>
      ))}
      {latest && (
        <text
          x={Math.min(x(latest.day), W - pad.r - 16)}
          y={y(latest.weightKg) + (zoom ? 18 : -9)}
          textAnchor="middle"
          className="chart-label actual"
        >
          {kg(latest.weightKg)}
        </text>
      )}
    </svg>
  );
}
