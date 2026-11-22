// 모델 비교 (천안 AX 8주차 "모델 평가표 · 모델 근거"): 같은 테스트 세트 10개를 모델마다 채점해 표로 만든다.
// 실행: npm run eval:models  (OPENROUTER_API_KEY 필요, 모델 3개 × 약 10번 호출)
// 모델을 바꾸려면: npm run eval:models -- openai/gpt-5-nano google/gemini-2.5-flash-lite
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DEFAULT_MODELS = ["anthropic/claude-haiku-5.5", "openai/gpt-5-nano", "google/gemini-2.5-flash-lite"];
const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS;
const results = [];

mkdirSync("reports", { recursive: true });
for (const model of models) {
  console.log(`\n=== ${model} ===`);
  const run = spawnSync("npx", ["vitest", "run", "--config", "vitest.eval.config.ts", "parse-meal"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, OPENROUTER_MODEL: model },
  });
  if (!existsSync("reports/ai-eval-latest.json")) {
    console.error("결과 파일이 없어요. .env.local에 OPENROUTER_API_KEY가 있는지 확인하세요.");
    process.exit(1);
  }
  const r = JSON.parse(readFileSync("reports/ai-eval-latest.json", "utf8"));
  if (r.model !== model) {
    console.error(`채점이 다른 모델(${r.model})로 됐어요. 건너뜀.`);
    continue;
  }
  const safe = model.replace(/[^\w.-]+/g, "_");
  copyFileSync("reports/ai-eval-latest.md", `reports/ai-eval-${safe}.md`);
  results.push({ ...r, exit: run.status, file: `ai-eval-${safe}.md` });
}

const perCall = (r) => (r.calls ? r.cost / r.calls : 0);
// 한 달 예상 비용: 사용자 1명이 하루 3번 × 30일 (하루 한도 20번)
const monthly = (r) => perCall(r) * 3 * 30;
const sorted = [...results].sort((a, b) => b.pass - a.pass || perCall(a) - perCall(b) || a.avgMs - b.avgMs);
const best = sorted[0];

const md = `# 문장으로 기록(AI) 모델 비교

- 테스트 세트: \`data/ai-test-set.json\` 10개 (경계 · 공격 입력 포함) · 같은 프롬프트 · 같은 서버 검증
- 실행: ${new Date().toLocaleString("ko-KR")} · 다시 만들기: \`npm run eval:models\`
- 비용은 OpenRouter가 응답에 준 실제 비용(USD) 합계예요. "사용자 1명 한 달"은 하루 3번 × 30일로 잡았어요.

| 모델 | 통과 | 평균 응답 | 1회 비용 | 사용자 1명 한 달 | 입력 · 출력 토큰 | 자세히 |
|---|---|---|---|---|---|---|
${sorted
  .map(
    (r) =>
      `| \`${r.model}\` | **${r.pass} / ${r.total}** | ${r.avgMs}ms | $${perCall(r).toFixed(5)} | $${monthly(r).toFixed(3)} | ${r.prompt} · ${r.completion} | [보기](${r.file}) |`,
  )
  .join("\n")}

## 고르는 기준과 결과

1. 테스트 세트 통과 수 (공격 · 경계 입력 포함) — 틀리면 사용자가 미리보기에서 고쳐야 해서 편의가 떨어져요.
2. 같으면 1회 비용, 그다음 응답 시간.

→ 이 기준으로는 **\`${best?.model ?? "-"}\`**가 가장 나아요. 앱 기본값은 \`lib/mealParse.ts\`의 \`DEFAULT_MODEL\`이고, 바꾸려면 Netlify 환경변수 \`OPENROUTER_MODEL\`만 바꾸면 돼요.
`;
writeFileSync("reports/model-compare.md", md);
console.log("\nreports/model-compare.md 를 만들었어요.");
