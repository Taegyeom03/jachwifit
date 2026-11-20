// 가격 공공데이터를 받는다.
// - KAMIS 농축수산물 소매가격(서울, 일별) Open API: https://www.kamis.or.kr 에서 무료 발급한 인증키 필요
// - 한국소비자원 생필품 가격 정보(참가격, 월별 CSV): 공공데이터포털 파일데이터 15083256
// 사용: KAMIS_CERT_KEY=... KAMIS_CERT_ID=... node scripts/fetch-public-prices.mjs <저장폴더> [YYYY-MM-DD]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [outDir, day = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
const { KAMIS_CERT_KEY: certKey, KAMIS_CERT_ID: certId } = process.env;
if (!outDir || !certKey || !certId) {
  console.error("사용: KAMIS_CERT_KEY=... KAMIS_CERT_ID=... node scripts/fetch-public-prices.mjs <저장폴더> [YYYY-MM-DD]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const UA = { "User-Agent": "Mozilla/5.0" };

// 1. KAMIS: 부류별(식량작물 · 채소 · 특용작물 · 과일 · 축산물 · 수산물) 서울 소매가격
const kamis = { day, items: [] };
for (const category of ["100", "200", "300", "400", "500", "600"]) {
  const q = new URLSearchParams({
    action: "dailyPriceByCategoryList",
    p_product_cls_code: "01", // 소매
    p_country_code: "1101", // 서울
    p_regday: day,
    p_convert_kg_yn: "N",
    p_item_category_code: category,
    p_cert_key: certKey,
    p_cert_id: certId,
    p_returntype: "json",
  });
  const res = await (await fetch(`https://www.kamis.or.kr/service/price/xml.do?${q}`, { headers: UA })).json();
  if (res.data?.error_code !== "000") throw new Error(`KAMIS ${category} 오류: ${JSON.stringify(res.data).slice(0, 200)}`);
  kamis.items.push(...res.data.item);
}
writeFileSync(join(outDir, "kamis.json"), JSON.stringify(kamis));
console.log(`KAMIS ${day}: ${kamis.items.length}개 품목`);

// 2. 참가격: 파일데이터 페이지에서 최신 파일 정보를 찾아 받는다 (EUC-KR CSV → UTF-8)
const PK = "15083256";
const page = await (await fetch(`https://www.data.go.kr/data/${PK}/fileData.do`, { headers: UA })).text();
const detailPk = page.match(/fn_fileDataDown\('\d+',\s*'(uddi:[^']+)'/)?.[1];
if (!detailPk) throw new Error("참가격 파일 정보를 찾지 못함");
const headers = { ...UA, Referer: `https://www.data.go.kr/data/${PK}/fileData.do` };
const meta = await (
  await fetch(
    `https://www.data.go.kr/tcs/dss/selectFileDataDownload.do?publicDataPk=${PK}&publicDataDetailPk=${detailPk}&fileDetailSn=1&publicDataTyCode=PR0051`,
    { headers },
  )
).json();
const file = await fetch(
  `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=${meta.atchFileId}&fileDetailSn=${meta.fileDetailSn}`,
  { headers },
);
const csv = new TextDecoder("euc-kr").decode(await file.arrayBuffer());
writeFileSync(join(outDir, "chamga.csv"), csv);
console.log(`참가격: ${meta.dataSetFileDetailInfo.dataNm} (${csv.split("\n").length - 1}건)`);
