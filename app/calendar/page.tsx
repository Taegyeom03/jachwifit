"use client";

import Link from "next/link";
import { useState } from "react";
import { findFood } from "@/lib/foods";
import { calcGoal } from "@/lib/goal";
import { dayStatus, dayTotals, entryTotals, type DayStatus } from "@/lib/nutrition";
import { MEALS, dateKey } from "@/lib/store";
import { TARGET_COVERAGE, TARGET_DAYS, successStats } from "@/lib/success";
import { useAppData } from "../useAppData";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_LABEL: Record<DayStatus, string> = {
  none: "기록 없음",
  good: "목표 이하",
  near: "10% 이내 초과",
  over: "10% 넘게 초과",
};

// 기능 3. 월간 캘린더 + 날짜별 상세
export default function CalendarPage() {
  const { ready, profile, logs } = useAppData();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => dateKey(today));

  if (!ready) return <p className="muted">불러오는 중…</p>;
  if (!profile) {
    return (
      <p className="panel">
        목표를 먼저 설정해 주세요. <Link href="/setup">목표 설정하기</Link>
      </p>
    );
  }

  const goal = calcGoal(profile);
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dateKey(new Date(year, m, i + 1))),
  ];

  // 이번 달 기록한 날 수
  const loggedDays = cells.filter((k) => k && logs[k]?.entries.length).length;
  const success = successStats(logs, today);

  const day = logs[selected];
  const totals = dayTotals(day);
  const status = dayStatus(day, goal);

  return (
    <>
      <div className="cal-head">
        <button type="button" onClick={() => setMonth(new Date(year, m - 1, 1))} aria-label="이전 달">
          ◀ 이전 달
        </button>
        <h1>
          {year}년 {m + 1}월
        </h1>
        <button type="button" onClick={() => setMonth(new Date(year, m + 1, 1))} aria-label="다음 달">
          다음 달 ▶
        </button>
      </div>
      <p className="muted small">이번 달 기록한 날 {loggedDays}일</p>

      <section className="panel goal-check">
        <h2>성공 지표 (최근 7일)</h2>
        <ul>
          <li className={success.loggedDays >= TARGET_DAYS ? "pass" : ""}>
            {success.loggedDays >= TARGET_DAYS ? "✅" : "⬜"} 7일 연속 기록: {success.loggedDays}/{TARGET_DAYS}일 기록 · 연속{" "}
            {success.streak}일
          </li>
          <li className={success.shownDays > 0 && success.overCount === 0 ? "pass" : ""}>
            {success.shownDays === 0 ? "⬜" : success.overCount === 0 ? "✅" : "❌"} 추천이 남은 칼로리를 넘은 경우:{" "}
            {success.overCount}건
          </li>
          <li className={success.avgCoverage != null && success.avgCoverage >= TARGET_COVERAGE ? "pass" : ""}>
            {success.avgCoverage == null ? "⬜" : success.avgCoverage >= TARGET_COVERAGE ? "✅" : "❌"} 단백질 부족분 평균 충족:{" "}
            {success.avgCoverage == null ? "-" : `${Math.round(success.avgCoverage * 100)}%`} (목표 80% · 추천을 본 날{" "}
            {success.shownDays}일)
          </li>
        </ul>
        <p className="muted small">추천 결과는 그날 오늘 화면에서 마지막으로 본 첫 번째 추천 조합 기준이에요.</p>
      </section>

      <div className="calendar panel">
        {WEEKDAYS.map((w) => (
          <span key={w} className="weekday">
            {w}
          </span>
        ))}
        {cells.map((k, i) =>
          k ? (
            <button
              key={k}
              type="button"
              className={`cal-day${k === selected ? " selected" : ""}${k === dateKey(today) ? " today" : ""}`}
              onClick={() => setSelected(k)}
              aria-label={`${Number(k.slice(8))}일 ${STATUS_LABEL[dayStatus(logs[k], goal)]}`}
            >
              {Number(k.slice(8))}
              <span className={`dot ${dayStatus(logs[k], goal)}`} />
            </button>
          ) : (
            <span key={`blank-${i}`} />
          ),
        )}
      </div>

      <div className="legend small">
        <span>
          <span className="dot good" /> 목표 이하
        </span>
        <span>
          <span className="dot near" /> 10% 이내 초과
        </span>
        <span>
          <span className="dot over" /> 10% 넘게 초과
        </span>
      </div>

      <section className="panel">
        <h2>
          {Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일{" "}
          <span className={`status ${status}`}>{STATUS_LABEL[status]}</span>
        </h2>
        {day?.entries.length ? (
          <>
            <p>
              {Math.round(totals.kcal)} / {Math.round(goal.targetKcal)}kcal · 단백질 {Math.round(totals.protein)} /{" "}
              {Math.round(goal.targetProtein)}g · 식비 {Math.round(totals.price).toLocaleString("ko-KR")}원
            </p>
            {MEALS.map((meal) => {
              const entries = day.entries.filter((e) => e.meal === meal);
              if (!entries.length) return null;
              return (
                <div key={meal} className="detail-meal">
                  <h3>{meal}</h3>
                  <ul>
                    {entries.map((e) => {
                      const t = entryTotals(e);
                      return (
                        <li key={e.id}>
                          {findFood(e.foodId)?.name ?? "삭제된 음식"}{" "}
                          <span className="muted small">
                            {t ? `${Math.round(t.kcal)}kcal · 단백질 ${Math.round(t.protein)}g` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </>
        ) : (
          <p className="muted">이 날은 기록이 없어요.</p>
        )}
        <Link href={selected === dateKey(today) ? "/" : `/?date=${selected}`} className="button">
          이 날 기록 고치기
        </Link>
      </section>
    </>
  );
}
