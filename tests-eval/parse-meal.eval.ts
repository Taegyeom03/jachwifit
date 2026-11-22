// 문장으로 기록(AI) 테스트 세트 10개 채점 → reports/ai-eval-latest.md
// 실제 AI를 부르므로 OPENROUTER_API_KEY가 있어야 한다(.env.local). 한 번에 약 10번 호출(수 원 이하).
import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import set from "@/data/ai-test-set.json";
import { FOODS } from "@/lib/foods";
import { DEFAULT_MODEL, parseMealText, type ParseResult } from "@/lib/mealParse";
import type { Meal } from "@/lib/store";

type Must = { food?: string; foodAny?: string[]; unit?: string; amount?: [number, number]; meal?: string };
type Expect = { must?: Must[]; mustNot?: string[]; maxItems?: number; maxAmount?: number; unknownIncludes?: string[] };

const key = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const nameOf = (id: number) => FOODS.find((f) => f.id === id)?.name ?? `#${id}`;
const rows: string[] = [];

function judge(r: ParseResult, e: Expect): string[] {
  const problems: string[] = [];
  for (const m of e.must ?? []) {
    const names = m.foodAny ?? [m.food!];
    const hit = r.items.find(
      (it) =>
        names.includes(nameOf(it.foodId)) &&
        (!m.unit || it.unit === m.unit) &&
        (!m.amount || (it.amount >= m.amount[0] && it.amount <= m.amount[1])) &&
        (!m.meal || it.meal === m.meal),
    );
    if (!hit) problems.push(`없음: ${names.join("/")}${m.amount ? ` ${m.amount.join("~")}` : ""}${m.unit ? ` ${m.unit}` : ""}${m.meal ? ` ${m.meal}` : ""}`);
  }
  for (const n of e.mustNot ?? []) if (r.items.some((it) => nameOf(it.foodId) === n)) problems.push(`있으면 안 됨: ${n}`);
  if (e.maxItems != null && r.items.length > e.maxItems) problems.push(`항목 ${r.items.length}개 > ${e.maxItems}`);
  if (e.maxAmount != null && r.items.some((it) => it.unit === "serving" && it.amount > e.maxAmount!)) problems.push(`양 ${e.maxAmount} 초과`);
  for (const u of e.unknownIncludes ?? []) if (!r.unknown.some((x) => x.includes(u))) problems.push(`못 찾은 것에 '${u}' 없음`);
  return problems;
}

describe.skipIf(!key)(`AI 테스트 세트 (${model})`, () => {
  for (const c of set.cases) {
    it(`#${c.id} ${c.kind}: ${c.input}`, async () => {
      const started = Date.now();
      let got = "";
      let problems: string[] = [];
      try {
        const r = await parseMealText({ text: c.input, foods: FOODS, defaultMeal: set.defaultMeal as Meal, apiKey: key!, model });
        got = r.items.map((it) => `${it.meal} ${nameOf(it.foodId)} ${it.amount}${it.unit === "g" ? "g" : "회"}`).join(", ") || "(없음)";
        if (r.unknown.length) got += ` · 못 찾음: ${r.unknown.join(", ")}`;
        problems = judge(r, c.expect as Expect);
      } catch (e) {
        got = `오류: ${(e as Error).message}`;
        problems = ["호출 실패"];
      }
      const ms = Date.now() - started;
      rows.push(`| ${c.id} | ${c.kind} | ${c.input} | ${c.criteria} | ${got} | ${problems.length ? `❌ ${problems.join("; ")}` : "✅"} | ${ms} |`);
      expect(problems, got).toEqual([]);
    });
  }

  afterAll(() => {
    const pass = rows.filter((r) => r.includes("| ✅ |")).length;
    mkdirSync("reports", { recursive: true });
    writeFileSync(
      "reports/ai-eval-latest.md",
      `# 문장으로 기록(AI) 테스트 세트 결과\n\n- 모델: \`${model}\` (OpenRouter)\n- 실행: ${new Date().toISOString()}\n- 결과: **${pass} / ${rows.length} 통과**\n\n| # | 종류 | 입력 | 판정 기준 | 결과 | 판정 | ms |\n|---|---|---|---|---|---|---|\n${rows
        .sort((a, b) => Number(a.split("|")[1]) - Number(b.split("|")[1]))
        .join("\n")}\n`,
    );
  });
});

it.skipIf(!!key)("OPENROUTER_API_KEY가 없어서 채점을 건너뜀 (.env.local에 넣고 다시 실행)", () => {});
