// 받은 가격 공공데이터로 data/foods.csv의 price · price_source · price_date를 다시 쓴다.
// 사용: node scripts/match-public-prices.mjs <fetch-public-prices.mjs로 받은 폴더>
//
// 음식마다 규칙(RULES)을 정해 둔다. 가격은 모두 "1회 제공량" 기준으로 환산한다.
// - kamis: KAMIS 소매가격 품목 하나 × factor (factor = 1회 제공량 / 조사 단위)
// - chamga: 참가격 상품들(상품명, factor)의 모든 조사값 × factor 의 중앙값 (1+1 행사 제외)
// 규칙이 없는 음식은 기존 값(임시값)을 그대로 둔다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RULES = {
  // KAMIS (서울 소매)
  계란: { kamis: { item: "계란", kind: /XL30구/ }, factor: 1 / 30, note: "XL 30구 ÷ 30" },
  바나나: { kamis: { item: "바나나", kind: /수입/, rank: /상품/ }, factor: 1.2, note: "100g × 1.2" },
  고구마: { kamis: { item: "고구마", kind: /밤/, rank: /상품/ }, factor: 0.15, note: "1kg × 0.15" },
  // 방울토마토 값이 없는 날은 대추방울토마토
  방울토마토: { kamis: { item: "방울토마토", rank: /상품/ }, factor: 0.15, note: "1kg × 0.15" },
  사과: { kamis: { item: "사과", kind: /후지/, rank: /상품/ }, factor: 0.1, note: "후지 10개 ÷ 10" },
  귤: { kamis: { item: "감귤", kind: /노지/, rank: /M과/ }, factor: 0.2, note: "노지 M과 10개 ÷ 5" },
  "돼지 앞다리살": { kamis: { item: "돼지", kind: /앞다리/ }, factor: 1, note: "100g" },
  "소고기 설도": { kamis: { item: "소", kind: /설도/, rank: /^1등급/ }, factor: 1, note: "1등급 100g" },
  아몬드: { kamis: { item: "아몬드", kind: /수입/ }, factor: 0.2, note: "100g × 0.2" },

  감자: { kamis: { item: "감자", kind: /수미/ }, factor: 1.5, note: "100g × 1.5" },
  시금치: { kamis: { item: "시금치" }, factor: 0.7, note: "100g × 0.7" },
  상추: { kamis: { item: "상추", kind: /청/ }, factor: 0.5, note: "100g × 0.5" },
  토마토: { kamis: { item: "토마토", rank: /상품/ }, factor: 0.2, note: "1kg × 0.2" },
  당근: { kamis: { item: "당근", rank: /상품/ }, factor: 0.1, note: "1kg × 0.1" },
  양파: { kamis: { item: "양파", rank: /상품/ }, factor: 0.1, note: "1kg × 0.1" },
  새송이버섯: { kamis: { item: "새송이버섯", rank: /상품/ }, factor: 1, note: "100g" },
  "돼지 목살": { kamis: { item: "돼지", kind: /목심/ }, factor: 1, note: "100g" },
  삼겹살: { kamis: { item: "돼지", kind: /삼겹살/ }, factor: 1, note: "100g" },
  땅콩: { kamis: { item: "땅콩", kind: /수입/ }, factor: 0.2, note: "100g × 0.2" },
  호두: { kamis: { item: "호두", kind: /수입/ }, factor: 0.15, note: "100g × 0.15" },
  "블루베리(냉동)": { kamis: { item: "블루베리", kind: /냉동/ }, factor: 0.1, note: "1kg × 0.1" },
  딸기: { kamis: { item: "딸기", kind: /설향/, rank: /상품/ }, factor: 0.3, note: "500g × 0.3" },
  "마른 멸치": { kamis: { item: "마른멸치" }, factor: 0.15, note: "100g × 0.15" },
  흰우유: { kamis: { item: "우유", kind: /흰우유/ }, factor: 0.2, note: "1L × 0.2" },

  // 참가격 (한국소비자원 생필품 가격)
  연어: { chamga: [["항공직송 동원생연어(350g)", 100 / 350], ["프리미엄 파타고니아 항공직송 생연어 필렛(500g)", 100 / 500]] },
  "3분 카레": { chamga: [["3분 쇠고기카레(200g)", 1], ["3분 백세카레 약간 매운맛(200g)", 1]] },
  "3분 짜장": { chamga: [["3분 쇠고기짜장(200g)", 1]] },
  소면: { chamga: [["옛날국수 소면(900g)", 100 / 900], ["백설 소면(900g)", 100 / 900]] },
  스파게티면: { chamga: [["청정원 스파게티(500g)", 0.2], ["오뚜기 프레스코 스파게티(500g)", 0.2], ["폰타나 이탈리아 캄파니아 스파게티(500g)", 0.2], ["백설 파스타(500g)", 0.2]] },
  우동: { chamga: [["CJ 가쓰오우동(4인)", 1 / 4], ["풀무원 정통가쓰오우동(4인)", 1 / 4], ["농심 생생우동(1개입)", 1]] },
  베이컨: { chamga: [["백설 햄스빌 두툼한 굿베이컨(340g)", 30 / 340], ["백설 햄스빌 베이컨(330g)", 30 / 330], ["주부9단 베이컨(180g)", 30 / 180], ["전G베이컨(200g)", 30 / 200]] },
  치킨너겟: { chamga: [["하림 통가슴살 치킨너겟(500g)", 100 / 500], ["고메 크리스피 너겟(450g)", 100 / 450], ["오뚜기 크런치 치킨너겟(480g)", 100 / 480]] },
  "냉동 돈까스": { chamga: [["롯데 쉐푸드 등심 통돈까스(300g)", 120 / 300], ["동원 퀴진 크리스피 돈까스 통등심(480g)", 120 / 480], ["오뚜기 등심돈까스(500g)", 120 / 500]] },
  맛살: { chamga: [["동원 싱싱맛살 실속(500g)", 50 / 500], ["김밥용 크래미(120g)", 50 / 120]] },
  훈제오리: { chamga: [["1등급 다향 훈제오리(500g)", 100 / 500]] },
  "냉동 볶음밥": { chamga: [["풀무원 통새우 볶음밥(450g)", 225 / 450], ["CJ 햇반 스팸김치볶음밥(440g)", 225 / 440]] },
  "즉석 죽": { chamga: [["동원 양반 쇠고기죽(287.5g)", 1], ["동원 양반 전복죽(287.5g)", 1]] },
  컵밥: { chamga: [["오뚜기 컵밥 제육덮밥(310g)", 1], ["햇반 컵반 철판제육덮밥(256g)", 1], ["햇반 컵반 미역국밥(167g)", 1]] },
  프랑크소시지: { chamga: [["주부9단 프랑크소시지(900g)", 60 / 900]] },
  즉석밥: { chamga: [["햇반(210g)", 1], ["오뚜기밥(210g)", 1]] },
  라면: { chamga: [["신라면(5개입)", 1 / 5], ["진라면 순한맛(5개입)", 1 / 5], ["진라면 매운맛(5개입)", 1 / 5], ["삼양라면(5개입)", 1 / 5]] },
  컵라면: { chamga: [["농심 신라면 큰사발면(114g)", 1], ["오뚜기 참깨라면 컵(110g)", 1]] },
  "참치캔(라이트)": { chamga: [["동원참치 라이트스탠다드(150g)", 100 / 150], ["사조참치 살코기 안심따개(150g)", 100 / 150]] },
  두부: { chamga: [["국산콩두부 부침용(380g)", 150 / 380], ["국산콩두부 찌개용(380g)", 150 / 380], ["행복한콩 부침두부(300g)", 150 / 300], ["행복한콩 찌개두부(300g)", 150 / 300]] },
  "저지방 우유": { chamga: [["매일우유 저지방 1%(900ml)", 200 / 900], ["서울우유 저지방 우유(1L)", 200 / 1000]] },
  "무가당 두유": { chamga: [["매일두유 99.9(12팩)", 1 / 12]] },
  "프로틴 음료": { chamga: [["빙그레 더단백 프로틴 드링크 초코(250ml)", 1], ["셀렉스 스포츠 웨이프로틴 초콜릿(330ml)", 250 / 330]] },
  배추김치: { chamga: [["비비고 포기배추김치(2.6kg)", 50 / 2600], ["종가 전라도 포기김치(2.8kg)", 50 / 2800], ["양반 포기김치(1.9kg)", 50 / 1900]] },
  조미김: { chamga: [["들기름 재래 도시락김(12봉)", 1 / 12]] },
  "냉동 만두": { chamga: [["고향만두(900g)", 120 / 900], ["풀무원 얄피꽉찬 고기만두(800g)", 120 / 800]] },
  어묵: { chamga: [["대림선어묵 부산어묵 마당놀이(200g)", 100 / 200], ["대림선어묵 부산어묵 마당놀이(300g)", 100 / 300], ["삼호어묵 안심얇은사각(400g)", 100 / 400]] },
  식빵: { chamga: [["촉촉한 우유식빵(330g)", 35 / 330], ["탕종숙식빵(420g)", 35 / 420]] },
  콘플레이크: { chamga: [["켈로그 콘푸로스트(600g)", 30 / 600], ["포스트 콘푸라이트(600g)", 30 / 600]] },
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.argv[2];
if (!dataDir) {
  console.error("사용: node scripts/match-public-prices.mjs <가격 공공데이터 폴더>");
  process.exit(1);
}

const toNum = (s) => {
  const n = Number(String(s ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round10 = (x) => Math.round(x / 10) * 10;

// KAMIS: 맞는 품목 중 값이 있는 첫 번째 (당일 값이 없으면 1일 전 값)
const kamis = JSON.parse(readFileSync(join(dataDir, "kamis.json"), "utf8"));
function kamisPrice({ item, kind, rank }) {
  const rows = kamis.items.filter(
    (i) => i.item_name === item && (!kind || kind.test(i.kind_name)) && (!rank || rank.test(i.rank)),
  );
  for (const row of rows) {
    const price = toNum(row.dpr1) ?? toNum(row.dpr2);
    if (price) return { price, row };
  }
  return null;
}

// 참가격: 상품명별 조사값 (1+1 행사 제외)
const [, ...chamgaLines] = readFileSync(join(dataDir, "chamga.csv"), "utf8").replace(/^﻿/, "").split(/\r?\n/);
const chamga = new Map();
let chamgaMonth = "";
for (const line of chamgaLines) {
  // 상품명,조사일,판매가격,판매업소,제조사,세일여부,원플러스원 (상품명에 쉼표가 없는 행만 사용)
  const cells = line.split(",");
  if (cells.length !== 7 || cells[6] === "Y") continue;
  const price = toNum(cells[2]);
  if (!price) continue;
  if (!chamga.has(cells[0])) chamga.set(cells[0], []);
  chamga.get(cells[0]).push(price);
  if (cells[1] > chamgaMonth) chamgaMonth = cells[1];
}
chamgaMonth = chamgaMonth.slice(0, 7);

// foods.csv 갱신
const csvPath = join(root, "data", "foods.csv");
const [header, ...lines] = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const cols = header.split(",");
const report = [];
const out = lines.map((line) => {
  const row = Object.fromEntries(cols.map((c, i) => [c, line.split(",")[i] ?? ""]));
  const rule = RULES[row.name];
  if (!rule) return row;

  if (rule.kamis) {
    const found = kamisPrice(rule.kamis);
    if (!found) {
      report.push(`${row.name}: KAMIS 값 없음 (기존 값 유지)`);
      return row;
    }
    const price = round10(found.price * rule.factor);
    report.push(`${row.name.padEnd(12)} ${row.price}→${price}원  KAMIS ${found.row.kind_name} ${found.price.toLocaleString()}원/${found.row.unit}`);
    return {
      ...row,
      price,
      price_source: `KAMIS 서울 소매 ${found.row.item_name} ${found.row.kind_name} ${found.row.rank} (${rule.note})`,
      price_date: kamis.day,
    };
  }

  const values = rule.chamga.flatMap(([name, factor]) => (chamga.get(name) ?? []).map((p) => p * factor));
  const missing = rule.chamga.filter(([name]) => !chamga.has(name)).map(([name]) => name);
  if (!values.length) {
    report.push(`${row.name}: 참가격 상품 없음 (기존 값 유지)`);
    return row;
  }
  const price = round10(median(values));
  report.push(`${row.name.padEnd(12)} ${row.price}→${price}원  참가격 ${values.length}건${missing.length ? ` (없는 상품: ${missing.join(" · ")})` : ""}`);
  return {
    ...row,
    price,
    price_source: `참가격 ${rule.chamga.map(([n]) => n).join(" · ")} ${values.length}건 중앙값`,
    price_date: chamgaMonth,
  };
});

const unknown = Object.keys(RULES).filter((name) => !out.some((r) => r.name === name));
if (unknown.length) throw new Error(`foods.csv에 없는 음식 규칙: ${unknown.join(", ")}`);

writeFileSync(csvPath, [cols.join(","), ...out.map((r) => cols.map((c) => String(r[c] ?? "").replace(/,/g, "·")).join(","))].join("\n") + "\n");
console.log(report.join("\n"));
console.log(`\n가격 갱신: ${out.filter((r) => !String(r.price_source).startsWith("임시값")).length}/${out.length}개 (나머지 임시값)`);
