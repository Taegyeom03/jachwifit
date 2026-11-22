// 실험: 추천 그리디(앱에서 쓰는 방식) vs 최적해(모든 조합 탐색) → reports/greedy-vs-optimal.md
// 같은 후보 음식 · 같은 제약(음식 3가지, 각 2회분, 남은 칼로리 이하)에서 여러 상황을 비교한다. AI 키 필요 없음.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { optimalCombo } from "@/lib/optimal";
import { candidateFoods, recommend, type Combo } from "@/lib/recommend";

const GAPS = [20, 40, 60, 80, 100, 120]; // 단백질 부족분(g)
const KCALS = [200, 400, 600, 900, 1200, 1600]; // 남은 칼로리(kcal)
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const desc = (c: Combo | null | undefined) =>
  c ? c.items.map((i) => `${i.food.name}×${i.servings}`).join(" + ") : "(없음)";

it("그리디 vs 최적해", () => {
  const rows: string[] = [];
  let same = 0;
  let lowerCoverage = 0;
  let pricier = 0;
  let extraSum = 0;
  let extraMax = 0;
  let greedyMs = 0;
  let optMs = 0;
  let n = 0;

  for (const gap of GAPS) {
    for (const kcal of KCALS) {
      let t = performance.now();
      const g = recommend({ proteinGap: gap, kcalLeft: kcal })[0];
      greedyMs += performance.now() - t;
      t = performance.now();
      const o = optimalCombo(candidateFoods({ kcalLeft: kcal }), gap, kcal);
      optMs += performance.now() - t;
      if (!g || !o) continue;
      n++;
      const covDiff = o.coverage - g.coverage;
      const extra = Math.abs(covDiff) < 1e-9 ? g.price - o.price : 0;
      let verdict: string;
      if (covDiff > 1e-9) {
        lowerCoverage++;
        verdict = `덜 채움 (${Math.round(g.coverage * 100)}% vs ${Math.round(o.coverage * 100)}%)`;
      } else if (extra > 1) {
        pricier++;
        extraSum += extra / o.price;
        extraMax = Math.max(extraMax, extra / o.price);
        verdict = `+${won(extra)} (+${Math.round((extra / o.price) * 100)}%)`;
      } else {
        same++;
        verdict = "최적";
      }
      rows.push(`| ${gap}g | ${kcal} | ${desc(g)} · ${won(g.price)} | ${desc(o)} · ${won(o.price)} | ${verdict} |`);
      expect(o.coverage).toBeGreaterThanOrEqual(g.coverage - 1e-9);
    }
  }

  const pct = (x: number) => `${Math.round((x / n) * 100)}%`;
  mkdirSync("reports", { recursive: true });
  writeFileSync(
    "reports/greedy-vs-optimal.md",
    `# 추천 실험: 그리디 vs 최적해

같은 후보 음식(\`candidateFoods\`)과 같은 제약(음식 최대 3가지 · 각 최대 2회분 · 합계 ≤ 남은 칼로리)에서
앱이 쓰는 **그리디**(단백질 1g당 가격이 싼 음식부터 담기)의 1등 조합과, 모든 조합을 따진 **최적해**
(① 부족분을 가장 많이 채우고 ② 그중 가장 싼 조합)를 비교했어요. 상황 ${n}개 = 단백질 부족분 ${GAPS.join("·")}g × 남은 칼로리 ${KCALS.join("·")}kcal.

## 요약

| 항목 | 결과 |
|---|---|
| 그리디가 최적과 같은 경우 | **${same} / ${n} (${pct(same)})** |
| 같은 만큼 채우지만 더 비싼 경우 | ${pricier} / ${n} (${pct(pricier)}) · 평균 +${pricier ? Math.round((extraSum / pricier) * 100) : 0}% · 최대 +${Math.round(extraMax * 100)}% |
| 최적보다 덜 채우는 경우 | ${lowerCoverage} / ${n} (${pct(lowerCoverage)}) |
| 걸린 시간 (상황 ${n}개 합계) | 그리디 ${greedyMs.toFixed(1)}ms · 최적해 ${optMs.toFixed(1)}ms |

해석: 그리디는 아주 빠르지만, 위 표만큼 최적보다 비싸거나 덜 채우는 경우가 있어요.
"덜 채움"은 대부분 **조금 덜 채우는 대신 더 싼** 조합이에요 (예: 부족분 97%를 4,100원 vs 100%를 4,580원).
즉 그리디는 "싸게"를, 최적해는 "부족분 100%"를 먼저 챙겨요. 어느 쪽이 나은지는 정책의 문제라, 앱에서 두 조합을 함께 보여 주는 것도 방법이에요.
최적해는 후보가 적은 지금(음식 104개 중 단백질이 많은 음식만)은 충분히 빠르지만, 음식이 늘거나 제약(음식 수 · 회분)이 커지면
경우의 수가 크게 늘어나요. 그래서 앱은 그리디를 쓰고, 이 실험으로 품질 차이를 확인해요.

## 상황별 결과

| 부족분 | 남은 kcal | 그리디 1등 | 최적해 | 판정 |
|---|---|---|---|---|
${rows.join("\n")}

> 다시 만들기: \`npm run experiment:recommend\`
`,
  );
});
