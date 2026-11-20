// 받은 공공데이터에서 자취핏 음식의 영양 정보를 찾아 data/foods.csv를 다시 쓴다.
// 사용: node scripts/match-public-data.mjs <fetch-public-data.mjs로 받은 폴더>
//
// 음식마다 규칙(아래 RULES)을 정해 둔다.
// - code: 공공데이터 식품코드 하나를 그대로 쓴다 (원재료 · 음식)
// - match: 이름이 맞는 제품 여러 개의 성분별 중앙값을 쓴다 (가공식품처럼 제품이 많은 경우)
// 영양 정보는 모두 100g(ml) 기준값을 1회 제공량(serving_g)으로 환산한다. 가격 · 태그 · 제공량은 기존 값을 유지한다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SETS = {
  raw: { pk: "15100065", label: "원재료성식품" },
  processed: { pk: "15100066", label: "가공식품" },
  dish: { pk: "15100070", label: "음식" },
};

// name은 foods.csv의 기존 이름, rename은 바꿀 이름
const RULES = [
  { name: "닭가슴살(훈제)", set: "processed", match: /닭\s?가슴살/, all: [/훈제|스모크/], exclude: /소시지|볶음밥|스테이크|볼|만두|김밥|샐러드|큐브|칩|바$|소스|죽|도시락|샌드|랩|부리또|핫도그/ },
  { name: "계란", set: "raw", code: "R210-003000001-0000" },
  { name: "구운 계란(편의점)", set: "processed", match: /구운\s?(계란|란)|맥반석\s?(계란|란)/, exclude: /빵|과자|스낵|칩/ },
  { name: "두부", set: "processed", match: /(부침|찌개|생식|국산콩|연|순|찜|모)?\s?두부$/, exclude: /건두부|유부|튀김|과자|스낵|면|강정|조림|전|바|김밥|소스|순두부|연두부/ },
  { name: "즉석밥", set: "processed", match: /즉석\s?밥|흰\s?밥|백미\s?밥|쌀\s?밥/, exclude: /곤약|현미|잡곡|귀리|렌틸|흑미|볶음|비빔|컵|덮밥|국밥|주먹밥|누룽지|떡|과자|김밥|보리|오곡|발아|찹쌀|영양|약밥|짜장|카레/ },
  // 가공식품의 현미밥은 도시락 제품이 섞여 있어 음식 DB의 현미밥을 쓴다
  { name: "현미 즉석밥", set: "dish", code: "D101-050000000-0001" },
  { name: "그릭요거트(무가당)", rename: "그릭요거트", set: "processed", match: /그릭\s?(요거트|요구르트)/, exclude: /바$|아이스|드링크|음료|볼|파우더|크런치|쿠키|칩|소스|드레싱|젤라또|케이크|샌드/ },
  { name: "저지방 우유", set: "processed", match: /저지방\s?우유/ },
  { name: "무가당 두유", set: "processed", match: /두유/, all: [/무가당|무첨가|담백|플레인|오리지널|당\s?무첨가/], exclude: /대두유|호두유|오일|크림|라떼|과자|단백|프로틴|분말/ },
  { name: "바나나", set: "raw", code: "R108-037000001-0000" },
  { name: "고구마", set: "raw", code: "R102-006000049-0000" },
  { name: "방울토마토", set: "raw", code: "R106-186010001-0000" },
  { name: "참치캔(라이트)", set: "processed", match: /참치/, all: [/라이트|살코기/], exclude: /김밥|죽|마요|비빔|찌개|주먹밥|삼각|샐러드|볶음|덮밥|고추|야채|짜장|카레|김치|소스|스프레드/ },
  { name: "고등어캔", set: "raw", code: "R211-021014028-0000" },
  // 받은 5만 건에는 분말 · 프로틴 워터만 있어 대표값으로 쓸 수 없다 → 제품 라벨 직접 확인
  { name: "프로틴 음료", keepTemp: "임시값(제품 라벨 확인 필요)" },
  { name: "단백질바", set: "processed", match: /(프로틴|단백질)\s?바/ },
  // 가공식품의 오트밀은 맛 오트밀 · 죽이 섞여 있어 귀리 원재료를 쓴다
  { name: "오트밀", set: "raw", code: "R101-001020101-0000" },
  { name: "닭가슴살 소시지", set: "processed", match: /닭\s?가슴살/, all: [/소시지|소세지/] },
  { name: "스트링치즈", set: "processed", match: /스트링\s?치즈/ },
  { name: "아몬드", set: "raw", code: "R105-020000058-0000" },
  { name: "브로콜리", set: "raw", code: "R106-092000047-0000" },
  { name: "양배추", set: "raw", code: "R106-129000001-0000" },
  { name: "참치마요 삼각김밥", set: "processed", match: /참치/, all: [/마요/, /삼각|김밥|주먹밥/] },
  { name: "편의점 샐러드", set: "processed", match: /샐러드/, all: [/그린|야채|채소|가든|양상추|믹스/], exclude: /드레싱|소스|닭|치킨|파스타|감자|마카로니|햄|에그|계란|크래미|과일|리코타|연어|새우|참치|불고기|샌드|김밥|두부|게살|맛살|훈제|고구마|단호박|콥|시저|우동|면|랩/ },
  { name: "닭가슴살 샐러드(편의점)", set: "processed", match: /샐러드/, all: [/닭\s?가슴살|치킨/], exclude: /드레싱|소스|샌드|랩|김밥|도시락|파스타|마카로니|부리또|또띠아|버거/ },
  { name: "컵라면", set: "processed", match: /컵\s?라면|사발면|큰\s?컵|왕뚜껑|육개장\s?사발/, exclude: /소스|스프|과자|스낵/ },
  { name: "라면", set: "processed", match: /라면$/, exclude: /컵|사발|볶음|비빔|짜장|소스|스프|과자|스낵|떡|쌀|건면|생라면|냉|라볶이|떡볶이|부대|우동|짬뽕|칼국수|곤약|두부|김치|해물|크림/ },
  { name: "김치", rename: "배추김치", set: "dish", code: "D315-670000000-0001" },
  { name: "조미김", set: "processed", match: /조미김|도시락김|재래김|파래김|식탁김|전장김/, exclude: /자반|스낵|부각|칩|볶음|김밥|플레이크|후레이크/ },
  { name: "돼지 앞다리살", set: "raw", code: "R209-014008801-0000" },
  { name: "소고기 홍두깨살", set: "raw", code: "R209-027061701-0000" },
  { name: "연어(냉동)", rename: "연어", set: "raw", code: "R211-201097301-8132" },
  { name: "오징어(냉동)", rename: "오징어", set: "raw", code: "R211-667014001-0008" },
  { name: "콩나물", set: "raw", code: "R106-182000046-0000" },
  { name: "콘플레이크", set: "processed", match: /콘\s?(플레이크|플레익|후레이크|푸레이크|프레이크)/, exclude: /바$|과자|스낵|초코|우유|볼/ },
  { name: "식빵", set: "processed", match: /식빵$/, exclude: /러스크|과자|스낵|칩|토스트|샌드|크럼|가루|쿠키/ },
  { name: "땅콩버터", set: "processed", match: /땅콩\s?버터|피넛\s?버터/, exclude: /과자|쿠키|샌드|바$|웨하스|크래커|볼|스낵|빵|캔디|초콜릿|초코|아이스/ },
  { name: "사과", set: "raw", code: "R108-050000001-0000" },
  { name: "귤", set: "raw", code: "R108-010020001-0000" },
  { name: "후라이드 치킨", set: "dish", match: /(후라이드|프라이드)\s?치킨|치킨_(후라이드|프라이드)/, exclude: /피자|버거|샐러드|랩|양념|간장|소스|순살|텐더|스틱|너겟|강정|가라아게/ },
  { name: "족발", set: "dish", code: "D107-344000000-0001" },
  { name: "떡볶이", set: "dish", code: "D110-467000000-0001" },
  { name: "피자", set: "dish", match: /^피자_.*(콤비네이션|불고기|페퍼로니)/, exclude: /치즈크러스트|엣지|크러스트|스틱|씬|더블|골드|리치|하프/ },
  { name: "제육볶음 정식", rename: "제육볶음", servingLabel: "1인분(250g)", servingG: 250, set: "dish", code: "D110-465000000-0001" },
  { name: "순두부찌개", set: "dish", match: /^순두부찌개_/, exclude: /간편조리세트/ },
  { name: "닭가슴살 볶음밥(냉동)", set: "processed", match: /닭\s?가슴살/, all: [/볶음밥/] },
  { name: "냉동 만두", set: "processed", match: /(고기|김치|왕|교자|물|군)\s?만두$/, exclude: /소스|피$|만두피|전|국|떡|라면|과자|스낵|샐러드|김밥/ },
  { name: "어묵", set: "processed", match: /어묵$|사각\s?어묵|부산\s?어묵/, exclude: /탕|국|볶음|바$|꼬치|소스|스프|김밥|떡볶이|우동|핫바|크림|치즈|칩|스낵/ },
  { name: "단백질 두유", keepTemp: "임시값(제품 라벨 확인 필요)" },
  { name: "곤약젤리", set: "processed", match: /곤약\s?젤리/ },
  { name: "아메리카노", set: "processed", match: /아메리카노/, exclude: /라떼|스틱|분말|원두|믹스|파우더|캡슐|라테|사탕|캔디|아이스크림|빵|과자|디카페인\s?믹스/ },
];

const NUTRIENTS = { kcal: "ENERC", protein: "PROT", carb: "CHOCDF", fat: "FATCE", fiber: "FIBTG" };
const MIN_PRODUCTS = 3;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.argv[2];
if (!dataDir) {
  console.error("사용: node scripts/match-public-data.mjs <공공데이터 폴더>");
  process.exit(1);
}

const sets = Object.fromEntries(
  Object.entries(SETS).map(([key, { pk }]) => [key, JSON.parse(readFileSync(join(dataDir, `${pk}.json`), "utf8"))]),
);

// 100g 또는 100ml 기준 값만 쓴다
const per100 = (r) => /^100\s?(g|ml)$/i.test(String(r.NUT_CON_SRTR_QUA ?? "").trim());
const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function resolve(rule) {
  const rows = sets[rule.set].filter(per100);
  if (rule.code) {
    const r = rows.find((x) => x.FOOD_CD === rule.code);
    if (!r) throw new Error(`${rule.name}: 식품코드 ${rule.code}를 찾지 못함`);
    return {
      values: Object.fromEntries(Object.entries(NUTRIENTS).map(([k, col]) => [k, num(r[col])])),
      source: `${SETS[rule.set].label} ${r.FOOD_CD} ${r.FOOD_NM} (${r.SRC_NM})`,
      date: r.CRTR_YMD,
      count: 1,
    };
  }
  const hits = rows.filter(
    (r) =>
      rule.match.test(r.FOOD_NM) &&
      (rule.all ?? []).every((re) => re.test(r.FOOD_NM)) &&
      !(rule.exclude && rule.exclude.test(r.FOOD_NM)) &&
      num(r.ENERC) != null &&
      num(r.PROT) != null,
  );
  // 제품이 너무 적으면 대표값으로 쓰지 않는다 (기존 값 유지)
  if (hits.length < (rule.set === "processed" ? MIN_PRODUCTS : 1)) return null;
  return {
    values: Object.fromEntries(Object.entries(NUTRIENTS).map(([k, col]) => [k, median(hits.map((r) => num(r[col])))])),
    source: `${SETS[rule.set].label} ${hits.length}개 중앙값 (${[...new Set(hits.slice(0, 3).map((r) => r.FOOD_NM))].join(", ")} 등)`,
    date: hits.map((r) => r.CRTR_YMD).sort().at(-1),
    count: hits.length,
  };
}

// 기존 foods.csv 읽기 (이름 · 제공량 · 가격 · 태그 유지)
const csvPath = join(root, "data", "foods.csv");
const [header, ...lines] = readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const cols = header.split(",");
const old = lines.map((l) => Object.fromEntries(cols.map((c, i) => [c, l.split(",")[i] ?? ""])));

const OUT_COLS = ["name", "serving_label", "serving_g", "kcal", "protein", "carb", "fat", "fiber", "price", "price_source", "price_date", "nutrition_source", "nutrition_date", "tags"];
const round1 = (x) => Math.round(x * 10) / 10;
const out = [];
const report = [];

for (const row of old) {
  const rule = RULES.find((r) => r.name === row.name || r.rename === row.name);
  if (!rule) throw new Error(`${row.name}: 규칙이 없음`);
  const found = rule.keepTemp ? null : resolve(rule);
  if (!found) {
    const reason = rule.keepTemp ?? "임시값(공공데이터에서 못 찾음)";
    out.push({ ...row, nutrition_source: reason, nutrition_date: "" });
    report.push(`${row.name.padEnd(14)} !! ${reason}`);
    continue;
  }
  const { values, source, date, count } = found;
  const servingG = rule.servingG ?? Number(row.serving_g);
  const k = servingG / 100;
  const next = {
    ...row,
    name: rule.rename ?? row.name,
    serving_label: rule.servingLabel ?? row.serving_label,
    serving_g: servingG,
    kcal: Math.round(values.kcal * k),
    protein: round1(values.protein * k),
    carb: round1((values.carb ?? 0) * k),
    fat: round1((values.fat ?? 0) * k),
    fiber: round1((values.fiber ?? 0) * k),
    nutrition_source: source.replace(/,/g, "·"),
    nutrition_date: date,
  };
  out.push(next);
  report.push(
    `${next.name.padEnd(14)} ${String(row.kcal).padStart(4)}→${String(next.kcal).padStart(4)}kcal  단백질 ${String(row.protein).padStart(4)}→${String(next.protein).padStart(5)}g  ${count > 1 ? `중앙값 ${count}개` : "단일"}${values.fiber == null ? "  (식이섬유 없음→0)" : ""}`,
  );
}

const csv = [OUT_COLS.join(","), ...out.map((r) => OUT_COLS.map((c) => String(r[c] ?? "").replace(/,/g, "·")).join(","))].join("\n") + "\n";
writeFileSync(csvPath, csv);
console.log(report.join("\n"));
console.log(`\ndata/foods.csv 갱신: ${out.length}개`);
