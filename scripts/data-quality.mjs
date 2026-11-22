// 음식 데이터 품질 리포트 (천안 AX 4주차: 구조 · 품질 확인 → 요약). 원본은 읽기만 한다.
// 실행: npm run data:quality → reports/data-quality.md
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync(new URL("../data/foods.csv", import.meta.url), "utf8").replace(/^﻿/, "");
const [header, ...lines] = raw.trim().split(/\r?\n/);
const cols = header.split(",");
// 따옴표 없는 단순 CSV (build-foods.mjs와 같은 가정). 칸 수가 다르면 문제로 기록한다.
const rows = lines.map((l, i) => ({ line: i + 2, cells: l.split(",") }));
const bad = rows.filter((r) => r.cells.length !== cols.length);
const recs = rows
  .filter((r) => r.cells.length === cols.length)
  .map((r) => Object.fromEntries(cols.map((c, i) => [c, r.cells[i]])));

const n = recs.length;
const pct = (x) => `${x}개 (${Math.round((x / n) * 100)}%)`;
const num = (v) => (v === "" ? null : Number(v));
const NUM_COLS = ["serving_g", "kcal", "protein", "carb", "fat", "fiber", "price"];

// 1) 빈 칸 · 숫자 아님 · 음수
const colRows = cols.map((c) => {
  const empty = recs.filter((r) => r[c] === "").length;
  const notNum = NUM_COLS.includes(c) ? recs.filter((r) => r[c] !== "" && !Number.isFinite(num(r[c]))).length : 0;
  const neg = NUM_COLS.includes(c) ? recs.filter((r) => num(r[c]) < 0).length : 0;
  return `| ${c} | ${empty} | ${NUM_COLS.includes(c) ? notNum : "-"} | ${NUM_COLS.includes(c) ? neg : "-"} |`;
});

// 2) 출처 구분
const isTemp = (s) => s.startsWith("임시값");
const priceTemp = recs.filter((r) => isTemp(r.price_source)).length;
const priceKamis = recs.filter((r) => r.price_source.startsWith("KAMIS")).length;
const pricePublic = n - priceTemp;
const nutTemp = recs.filter((r) => isTemp(r.nutrition_source)).length;
const nutApi = recs.filter((r) => r.nutrition_source.startsWith("식품영양성분DB API")).length;

// 3) 열량 검산: 4·4·9 규칙으로 계산한 칼로리와 표시 칼로리 차이 (25% 넘게 다르면 확인 대상)
const energy = recs
  .map((r) => {
    const calc = 4 * num(r.protein) + 4 * num(r.carb) + 9 * num(r.fat);
    const kcal = num(r.kcal);
    return { name: r.name, kcal, calc, diff: kcal ? (calc - kcal) / kcal : 0 };
  })
  .filter((e) => e.kcal > 20 && Math.abs(e.diff) > 0.25)
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

// 4) 범위 확인 (1회 제공량 기준)
const outliers = recs.filter(
  (r) => num(r.kcal) > 1200 || num(r.protein) > 80 || num(r.price) > 20000 || num(r.serving_g) <= 0,
);

// 5) 이름 중복
const dup = Object.entries(recs.reduce((m, r) => ((m[r.name] = (m[r.name] ?? 0) + 1), m), {})).filter(([, c]) => c > 1);

// 6) 태그 분포
const tags = {};
for (const r of recs) for (const t of r.tags.split("|").filter(Boolean)) tags[t] = (tags[t] ?? 0) + 1;

const dates = (k) => {
  const d = recs.map((r) => r[k]).filter(Boolean).sort();
  return `${d[0]} ~ ${d.at(-1)}`;
};

const md = `# 음식 데이터 품질 리포트

- 원본: \`data/foods.csv\` (읽기만 함, 고치지 않음)
- 만든 날: ${new Date().toLocaleDateString("sv-SE")} · 다시 만들기: \`npm run data:quality\`
- 한 행의 뜻: **음식 1개의 1회 제공량** 기준 영양 · 가격 (단위는 \`docs\`의 데이터 사전 참고)

## 1. 구조

| 항목 | 결과 |
|---|---|
| 음식 수 | ${n}개 |
| 칸 수 | ${cols.length}개 (${cols.join(", ")}) |
| 칸 수가 맞지 않는 줄 | ${bad.length ? bad.map((b) => `${b.line}번째 줄`).join(", ") : "없음"} |
| 이름 중복 | ${dup.length ? dup.map(([k, c]) => `${k}(${c})`).join(", ") : "없음"} |

## 2. 빈 칸 · 형식

| 칸 | 빈 칸 | 숫자 아님 | 음수 |
|---|---|---|---|
${colRows.join("\n")}

> 식이섬유 0은 "표시 의무가 없어 빈 칸이던 값을 0으로 본 것"을 포함해요 (DA-D1). 원본 API 응답은 보존하고 앱용 요약값만 0으로 둬요.

## 3. 출처

| 구분 | 공공데이터 | 임시값 |
|---|---|---|
| 영양 정보 | ${pct(n - nutTemp)} (그중 식약처 Open API ${nutApi}개) | ${pct(nutTemp)} |
| 가격 | ${pct(pricePublic)} (그중 KAMIS ${priceKamis}개) | ${pct(priceTemp)} |

- 영양 기준일: ${dates("nutrition_date")} · 가격 기준일: ${dates("price_date")}
- 임시값은 화면에 "임시값"으로 표시하고, 사용자가 [가격]에서 내가 산 가격으로 바꿀 수 있어요.

## 4. 열량 검산 (단백질 · 탄수화물 4kcal/g, 지방 9kcal/g)

표시 칼로리와 계산 칼로리가 25% 넘게 다른 음식: **${energy.length}개**${energy.length ? "" : " (모두 25% 이내)"}

${energy.length ? `| 음식 | 표시 kcal | 계산 kcal | 차이 |\n|---|---|---|---|\n${energy.map((e) => `| ${e.name} | ${e.kcal} | ${Math.round(e.calc)} | ${e.diff > 0 ? "+" : ""}${Math.round(e.diff * 100)}% |`).join("\n")}\n\n> 알코올 · 당알코올 · 식이섬유 · 반올림 때문에 생길 수 있어요. 차이가 큰 음식은 원본을 다시 확인할 대상이에요.` : ""}

## 5. 범위 확인 (1회 제공량 kcal > 1,200 · 단백질 > 80g · 가격 > 20,000원 · 무게 ≤ 0)

${outliers.length ? outliers.map((r) => `- ${r.name}: ${r.kcal}kcal · 단백질 ${r.protein}g · ${r.price}원 · ${r.serving_g}g`).join("\n") : "- 해당 없음"}

## 6. 태그 분포

| 태그 | 음식 수 |
|---|---|
${Object.entries(tags)
  .sort((a, b) => b[1] - a[1])
  .map(([t, c]) => `| ${t} | ${c} |`)
  .join("\n")}

## 7. 결론과 남은 질문

- 구조 · 형식 문제${bad.length || dup.length ? "가 있어요(위 표)" : "는 없어요"}. 영양 정보는 ${nutTemp ? `${nutTemp}개가 임시값이에요` : "모두 공공데이터예요"}.
- **가격 임시값 ${priceTemp}개**가 가장 큰 품질 문제예요. 추천 식비가 실제와 다를 수 있어요 → 직접 조사 · 내 가격 입력으로 보완.
- 남은 질문: 편의점 · 학식 · 배달 메뉴를 어떻게 넣을지(공개 가격 데이터 없음), 식이섬유 빈 칸을 음식별로 따로 기록할지.
`;

mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
writeFileSync(new URL("../reports/data-quality.md", import.meta.url), md);
console.log(`reports/data-quality.md (음식 ${n}개, 가격 임시값 ${priceTemp}, 열량 검산 확인 대상 ${energy.length})`);
