// 공공데이터포털 식약처「식품영양성분DB정보」Open API로 이름 검색해, 임시값인 음식의 영양 정보를 채운다.
// 파일 다운로드(5만 건)에 없던 제품(프로틴 음료 · 단백질 두유)을 찾기 위해 쓴다.
//
// 키: 공공데이터포털 마이페이지 → 개발계정 → 일반 인증키(Decoding)를 .env.local의 DATA_GO_KR_KEY에 넣는다.
// 사용: node scripts/fetch-nutrition-api.mjs          # 찾은 후보와 바뀔 값만 출력 (파일은 안 바꿈)
//       node scripts/fetch-nutrition-api.mjs --write  # data/foods.csv 갱신
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03";

// name: foods.csv 이름, queries: API 이름 검색어, match/exclude: 결과 이름 필터
const RULES = [
  {
    name: "프로틴 음료",
    queries: ["프로틴 드링크", "프로틴음료", "프로틴 음료", "단백질 음료", "더단백"],
    match: /프로틴|단백/,
    exclude: /분말|파우더|쉐이크|바$|볼|칩|과자|두유|워터|젤리|시리얼|요거트|요구르트|아이스/,
  },
  {
    name: "단백질 두유",
    queries: ["단백질 두유", "프로틴 두유", "고단백 두유"],
    match: /두유/,
    all: [/단백|프로틴/],
    exclude: /분말|파우더|바$|과자|대두유/,
  },

  // 2026-11-22 추가: 식단 기록에 필요한 음식. 없으면 foods.csv 맨 뒤에 새로 넣는다 (기존 음식 id가 바뀌지 않게).
  // code: 식품코드 하나를 그대로 쓴다. 가격은 공공데이터가 없어 임시값.
  {
    name: "돼지 안심",
    queries: ["돼지고기"],
    code: "R109-014008701-0000", // 돼지고기, 안심, 생것
    add: { serving_label: "1회(100g)", serving_g: 100, price: 1500, tags: "원재료|간단조리" },
  },
  {
    name: "공기밥",
    queries: ["쌀밥"],
    code: "D301-022000000-0001", // 쌀밥 (음식)
    add: { serving_label: "1공기(210g)", serving_g: 210, price: 1000, tags: "간단조리" },
  },
  {
    name: "간장",
    queries: ["진간장", "양조간장"],
    match: /간장/,
    exclude: /소스|불고기|조림|게장|치킨|맛간장|국간장|어간장|분말|드레싱/,
    add: { serving_label: "1큰술(15ml)", serving_g: 15, price: 50, tags: "간단조리" },
  },
  {
    name: "돼지갈비",
    queries: ["돼지갈비구이"],
    code: "D308-373010000-0001", // 돼지갈비구이_간장 (음식)
    add: { serving_label: "1인분(250g)", serving_g: 250, price: 16000, tags: "치팅" },
  },
];

function loadKey() {
  if (process.env.DATA_GO_KR_KEY) return process.env.DATA_GO_KR_KEY.trim();
  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATA_GO_KR_KEY="));
    const v = line?.slice("DATA_GO_KR_KEY=".length).trim();
    if (v) return v;
  }
  console.error("DATA_GO_KR_KEY가 없습니다. .env.local에 DATA_GO_KR_KEY=발급받은키(Decoding) 를 넣어 주세요.");
  process.exit(1);
}

const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const round1 = (x) => Math.round(x * 10) / 10;

function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// "100ml", "100g", "250 mL" 등 → 숫자. 100 기준이 아니면 100 기준으로 환산할 때 쓴다.
function baseAmount(s) {
  const m = String(s ?? "").trim().match(/^([\d.]+)\s*(g|ml)$/i);
  return m ? Number(m[1]) : null;
}

async function search(key, query) {
  const items = [];
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({ serviceKey: key, pageNo: page, numOfRows: 100, type: "json", FOOD_NM_KR: query });
    const res = await fetch(`${ENDPOINT}?${q}`);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`API 응답이 JSON이 아님 (HTTP ${res.status}): ${text.slice(0, 200)}\n키가 아직 활성화되지 않았거나 Encoding 키를 넣었을 수 있습니다.`);
    }
    const header = json.header ?? json.response?.header;
    const body = json.body ?? json.response?.body;
    if (header?.resultCode && header.resultCode !== "00") throw new Error(`API 오류 ${header.resultCode}: ${header.resultMsg}`);
    let list = body?.items?.item ?? body?.items ?? [];
    if (!Array.isArray(list)) list = [list];
    items.push(...list);
    if (list.length < 100) break;
  }
  return items;
}

const key = loadKey();
const write = process.argv.includes("--write");

const csvPath = join(root, "data", "foods.csv");
const raw = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const [header, ...lines] = raw.split(/\r?\n/).filter((l) => l.trim());
const cols = header.split(",");
const rows = lines.map((l) => Object.fromEntries(cols.map((c, i) => [c, l.split(",")[i] ?? ""])));
const today = new Date().toISOString().slice(0, 10);

for (const rule of RULES) {
  let row = rows.find((r) => r.name === rule.name);
  if (!row) {
    if (!rule.add) {
      console.log(`${rule.name}: foods.csv에 없음, 건너뜀`);
      continue;
    }
    row = { name: rule.name, ...rule.add, kcal: "", protein: "", carb: "", fat: "", fiber: "", price_source: "임시값", price_date: today };
    rows.push(row);
    console.log(`${rule.name}: foods.csv에 새로 추가`);
  }

  const seen = new Map();
  for (const q of rule.queries) for (const it of await search(key, q)) seen.set(it.FOOD_CD ?? `${it.FOOD_NM_KR}|${it.MAKER_NM}`, it);

  const picked = [...seen.values()].filter((it) => {
    const n = String(it.FOOD_NM_KR ?? "");
    const base = baseAmount(it.SERVING_SIZE);
    if (rule.code) return it.FOOD_CD === rule.code && base && num(it.AMT_NUM1) != null;
    // 100ml당 20kcal 미만은 기준량 오기입으로 보고 뺀다 (예: 베어그릭스 고단백 두유 7kcal)
    const plausible = base && num(it.AMT_NUM1) != null && (num(it.AMT_NUM1) * 100) / base >= 20;
    return rule.match.test(n) && (rule.all ?? []).every((re) => re.test(n)) && !rule.exclude?.test(n) && plausible;
  });

  console.log(`\n[${rule.name}] 검색 ${seen.size}건 → 사용 ${picked.length}건`);
  for (const it of picked.slice(0, 15)) console.log(`  - ${it.FOOD_NM_KR} (${it.MAKER_NM ?? "-"}) ${it.SERVING_SIZE} 당 ${it.AMT_NUM1}kcal 단백질 ${it.AMT_NUM3}g`);
  if (picked.length > 15) console.log(`  ... 외 ${picked.length - 15}건`);
  if (!picked.length) {
    console.log("  맞는 제품이 없어 임시값을 유지합니다. RULES의 검색어 · 필터를 조정해 보세요.");
    continue;
  }

  // 100g(ml) 기준으로 맞춘 뒤 성분별 중앙값
  // 빈 값은 0으로 본다 (가공식품은 표시 의무가 없는 성분이 비어 있음, match-public-data.mjs와 같은 규칙)
  const per100 = (field) => picked.map((it) => ((num(it[field]) ?? 0) * 100) / baseAmount(it.SERVING_SIZE));
  const v = { kcal: median(per100("AMT_NUM1")), protein: median(per100("AMT_NUM3")), fat: median(per100("AMT_NUM4")), carb: median(per100("AMT_NUM6")), fiber: median(per100("AMT_NUM8")) };
  const k = Number(row.serving_g) / 100;
  const next = {
    kcal: Math.round(v.kcal * k),
    protein: round1((v.protein ?? 0) * k),
    carb: round1((v.carb ?? 0) * k),
    fat: round1((v.fat ?? 0) * k),
    fiber: round1((v.fiber ?? 0) * k),
  };
  const names = picked.slice(0, 3).map((it) => it.FOOD_NM_KR).join("· ");
  next.nutrition_source = (
    rule.code
      ? `식품영양성분DB API ${picked[0].FOOD_CD} ${picked[0].FOOD_NM_KR} (${picked[0].DB_GRP_NM})`
      : `식품영양성분DB API ${picked.length}개 중앙값 (${names} 등)`
  ).replace(/,/g, "·");
  next.nutrition_date = today;

  console.log(`  → ${row.serving_label} 기준: ${row.kcal}→${next.kcal}kcal, 단백질 ${row.protein}→${next.protein}g, 탄수 ${row.carb}→${next.carb}g, 지방 ${row.fat}→${next.fat}g`);
  Object.assign(row, next);
}

if (write) {
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => String(r[c] ?? "").replace(/,/g, "·")).join(","))].join("\n") + "\n";
  writeFileSync(csvPath, csv);
  console.log("\ndata/foods.csv 갱신 완료");
} else {
  console.log("\n미리보기만 했습니다. 반영하려면 --write 를 붙여 다시 실행하세요.");
}
