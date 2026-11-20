// PRD Q6 성공 지표: 7일 연속 기록, 추천이 남은 칼로리를 넘은 경우 0건, 단백질 부족분 평균 80% 이상 충족
import { dateKey, type Logs } from "./store";

export const TARGET_DAYS = 7;
export const TARGET_COVERAGE = 0.8;

export type SuccessStats = {
  loggedDays: number; // 최근 7일 중 기록한 날
  streak: number; // 오늘(오늘 기록이 없으면 어제)까지 연속 기록한 날
  overCount: number; // 추천 조합이 남은 칼로리를 넘은 경우
  shownDays: number; // 추천을 보여 준 날
  avgCoverage: number | null; // 추천을 보여 준 날의 첫 번째 조합 평균 충족률
};

export function successStats(logs: Logs, today = new Date()): SuccessStats {
  const keys = Array.from({ length: TARGET_DAYS }, (_, i) =>
    dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)),
  );
  const logged = (k: string) => (logs[k]?.entries.length ?? 0) > 0;

  // 오늘 아직 기록 전이면 어제부터 센다
  let streak = 0;
  for (let i = logged(keys[0]) ? 0 : 1; i < 400; i++) {
    const k = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    if (!logged(k)) break;
    streak++;
  }

  let overCount = 0;
  const coverages: number[] = [];
  for (const k of keys) {
    const rec = logged(k) ? logs[k].rec : undefined;
    if (rec?.status !== "shown") continue;
    overCount += rec.over;
    coverages.push(rec.coverage);
  }

  return {
    loggedDays: keys.filter(logged).length,
    streak,
    overCount,
    shownDays: coverages.length,
    avgCoverage: coverages.length ? coverages.reduce((a, b) => a + b, 0) / coverages.length : null,
  };
}
