"use client";

import Link from "next/link";
import { calcGoal } from "@/lib/goal";
import { dayTotals, entryTotals, kcalLimit } from "@/lib/nutrition";
import { proteinDensityRanking } from "@/lib/recommend";
import { MEALS, dateKey } from "@/lib/store";
import { useAppData } from "../useAppData";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

// 데이터 인사이트: 칼로리 대비 단백질이 많은 음식 + 내 최근 7일 섭취 패턴
export default function InsightsPage() {
  const { ready, profile, logs } = useAppData();
  const density = proteinDensityRanking().slice(0, 10);
  const bestDensity = density[0]?.gramPer100kcal ?? 1;

  return (
    <>
      <h1>인사이트</h1>
      <p className="muted">공공데이터로 만든 음식 데이터와 내 기록에서 찾은 것들이에요.</p>

      <section className="panel">
        <h2>칼로리 대비 단백질 TOP 10</h2>
        <p className="muted small">100kcal를 먹을 때 단백질을 많이 얻는 순서예요. 남은 칼로리가 적은 날에 좋아요.</p>
        <ol className="rank">
          {density.map(({ food, gramPer100kcal }) => (
            <li key={food.id}>
              <div className="rank-head">
                <span>{food.name}</span>
                <b>100kcal당 {gramPer100kcal.toFixed(1)}g</b>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${(gramPer100kcal / bestDensity) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {ready && <WeekPattern profile={profile} logs={logs} />}
    </>
  );
}

function WeekPattern({ profile, logs }: Pick<ReturnType<typeof useAppData>, "profile" | "logs">) {
  if (!profile) {
    return (
      <p className="panel">
        목표를 설정하고 기록하면 내 섭취 패턴을 볼 수 있어요. <Link href="/setup">목표 설정하기</Link>
      </p>
    );
  }

  const goal = calcGoal(profile);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
    const key = dateKey(d);
    const day = logs[key];
    return { key, d, day, totals: dayTotals(day), limit: kcalLimit(goal, day), logged: !!day?.entries.length };
  });
  const logged = days.filter((d) => d.logged);

  if (!logged.length) {
    return <p className="panel muted">최근 7일 기록이 없어요. 기록을 시작하면 여기에 패턴이 나와요.</p>;
  }

  const avg = (f: (d: (typeof logged)[number]) => number) => logged.reduce((s, d) => s + f(d), 0) / logged.length;
  const maxKcal = Math.max(...days.map((d) => Math.max(d.totals.kcal, d.limit)));

  // 끼니별 칼로리 비중
  const mealKcal = Object.fromEntries(MEALS.map((m) => [m, 0])) as Record<(typeof MEALS)[number], number>;
  for (const { day } of logged) {
    for (const e of day!.entries) mealKcal[e.meal] += entryTotals(e)?.kcal ?? 0;
  }
  const totalKcal = Object.values(mealKcal).reduce((a, b) => a + b, 0) || 1;
  const proteinDays = logged.filter((d) => d.totals.protein >= goal.targetProtein).length;

  return (
    <section className="panel">
      <h2>최근 7일 패턴</h2>
      <div className="week-chart" role="img" aria-label="최근 7일 칼로리">
        {days.map(({ key, d, totals, limit, day }) => (
          <div key={key} className="week-col">
            <div className="week-bars">
              <div className="week-limit" style={{ bottom: `${(limit / maxKcal) * 100}%` }} />
              <div
                className={`week-bar${totals.kcal > limit ? " over" : ""}`}
                style={{ height: `${(totals.kcal / maxKcal) * 100}%` }}
                title={`${Math.round(totals.kcal)} / ${Math.round(limit)}kcal`}
              />
            </div>
            <span className="small">
              {d.getDate()}
              {day?.cheat ? "★" : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="muted small">막대: 먹은 칼로리 · 가로선: 그날 칼로리 상한 (★ 치팅데이)</p>

      <div className="stats">
        <div className="stat">
          <span>평균 칼로리 ({logged.length}일)</span>
          <b>
            {Math.round(avg((d) => d.totals.kcal))} / {Math.round(goal.targetKcal)}kcal
          </b>
        </div>
        <div className="stat">
          <span>평균 단백질</span>
          <b>
            {Math.round(avg((d) => d.totals.protein))} / {Math.round(goal.targetProtein)}g
          </b>
        </div>
        <div className="stat">
          <span>단백질 목표 달성</span>
          <b>
            {proteinDays} / {logged.length}일
          </b>
        </div>
        <div className="stat">
          <span>하루 평균 식비</span>
          <b>{won(avg((d) => d.totals.price))}</b>
        </div>
      </div>

      <h3 className="sub">끼니별 칼로리 비중</h3>
      <div className="meal-share">
        {MEALS.filter((m) => mealKcal[m] > 0).map((m) => (
          <div key={m} className={`meal-seg m-${MEALS.indexOf(m)}`} style={{ width: `${(mealKcal[m] / totalKcal) * 100}%` }}>
            {mealKcal[m] / totalKcal >= 0.12 ? m : ""}
          </div>
        ))}
      </div>
      <p className="muted small">
        {MEALS.filter((m) => mealKcal[m] > 0)
          .map((m) => `${m} ${Math.round((mealKcal[m] / totalKcal) * 100)}%`)
          .join(" · ")}
      </p>
    </section>
  );
}
