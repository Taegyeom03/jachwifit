"use client";

import Link from "next/link";
import { useState } from "react";
import { isTemporary } from "@/lib/foods";
import { calcGoal } from "@/lib/goal";
import { buildDayPlans, formatKoreanDate, weightPath, type WeightPoint } from "@/lib/plan";
import { FoodLine, SourceNote } from "../components/Recommendations";
import { useAppData } from "../useAppData";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const kg = (n: number) => `${Math.round(n * 10) / 10}kg`;

// 처음 시작 화면 2단계: 목표를 저장한 뒤 "이렇게 먹으면 언제쯤 목표 체중" 계획을 보여 준다
export default function PlanPage() {
  const { ready, profile } = useAppData();
  const [variant, setVariant] = useState(0);

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
  const path = weightPath(profile, goal);
  const end = path[path.length - 1];
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

      {path.length > 1 && (
        <section className="panel">
          <h2>주차별 예상 체중</h2>
          <WeightChart points={path} />
          <p className="muted small">
            하루 {fmt(goal.dailyDeficit)}kcal 적게 먹으면 7,700kcal당 1kg이 빠진다고 보고 계산했어요. 실제로는 몸이 적응해
            중간에 정체기가 올 수 있어요.
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

// 주차별 예상 체중 꺾은선 (SVG, 화면 폭에 맞춰 늘어남)
function WeightChart({ points }: { points: WeightPoint[] }) {
  // 휴대폰 폭(약 310px)에서도 글씨가 11px 이상 보이도록 작은 좌표계를 쓴다
  const W = 360;
  const H = 170;
  const pad = { l: 46, r: 18, t: 14, b: 26 };
  const first = points[0];
  const last = points[points.length - 1];
  const hi = Math.ceil(first.weightKg + 0.5);
  const lo = Math.floor(last.weightKg - 0.5);
  const x = (w: number) => pad.l + (w / last.week) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const line = points.map((p) => `${x(p.week).toFixed(1)},${y(p.weightKg).toFixed(1)}`).join(" ");
  // 4주마다 눈금 (너무 길면 8주)
  const step = last.week > 24 ? 8 : 4;
  const ticks = points.filter((p) => p.week % step === 0 && p.week !== last.week);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="weight-chart" role="img" aria-label={`${first.weightKg}kg에서 ${last.weightKg}kg까지 ${last.week}주 예상`}>
      <line x1={pad.l} x2={W - pad.r} y1={y(last.weightKg)} y2={y(last.weightKg)} className="chart-goal" />
      <text x={pad.l - 6} y={y(first.weightKg) + 4} textAnchor="end" className="chart-label">
        {kg(first.weightKg)}
      </text>
      <text x={pad.l - 6} y={y(last.weightKg) + 4} textAnchor="end" className="chart-label">
        {kg(last.weightKg)}
      </text>
      {[...ticks, last].map((p) => (
        <text key={p.week} x={x(p.week)} y={H - 8} textAnchor="middle" className="chart-label">
          {p.week === 0 ? "오늘" : `${p.week}주`}
        </text>
      ))}
      <polyline points={line} className="chart-line" />
      <circle cx={x(first.week)} cy={y(first.weightKg)} r={4} className="chart-dot" />
      <circle cx={x(last.week)} cy={y(last.weightKg)} r={5} className="chart-dot goal" />
    </svg>
  );
}
