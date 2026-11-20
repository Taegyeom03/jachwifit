// data/foods.csv를 읽어 앱에서 쓰는 lib/foods.data.json으로 바꾼다.
// 사용: node scripts/build-foods.mjs (dev · build 전에 자동 실행)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csv = readFileSync(join(root, "data", "foods.csv"), "utf8").replace(/^﻿/, "");

const [header, ...lines] = csv.split(/\r?\n/).filter((l) => l.trim());
const cols = header.split(",");
const NUMBER_COLS = ["serving_g", "kcal", "protein", "carb", "fat", "fiber", "price"];

const errors = [];
const foods = lines.map((line, i) => {
  const cells = line.split(",");
  if (cells.length !== cols.length) errors.push(`${i + 2}행: 칸 수가 ${cells.length}개 (필요 ${cols.length}개)`);
  const row = Object.fromEntries(cols.map((c, j) => [c, (cells[j] ?? "").trim()]));
  for (const c of NUMBER_COLS) {
    const n = Number(row[c]);
    if (row[c] === "" || Number.isNaN(n) || n < 0) errors.push(`${i + 2}행 ${row.name}: ${c} 값이 숫자가 아님`);
    row[c] = n;
  }
  return {
    id: i + 1,
    name: row.name,
    servingLabel: row.serving_label,
    servingG: row.serving_g,
    kcal: row.kcal,
    protein: row.protein,
    carb: row.carb,
    fat: row.fat,
    fiber: row.fiber,
    price: row.price,
    priceSource: row.price_source,
    priceDate: row.price_date,
    tags: row.tags ? row.tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
  };
});

if (errors.length) {
  console.error("foods.csv 오류:\n" + errors.join("\n"));
  process.exit(1);
}

writeFileSync(join(root, "lib", "foods.data.json"), JSON.stringify(foods, null, 2) + "\n");
console.log(`foods.csv → lib/foods.data.json (${foods.length}개)`);
