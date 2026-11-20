// 공공데이터포털의 「전국통합식품영양성분정보」 표준데이터를 받아 JSON으로 저장한다.
// 사용: node scripts/fetch-public-data.mjs <저장폴더>
// 원본은 크기가 커서(약 120MB) 저장소에 넣지 않는다.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATASETS = {
  raw: { pk: "15100065", label: "원재료성식품" },
  processed: { pk: "15100066", label: "가공식품" },
  dish: { pk: "15100070", label: "음식" },
};

const outDir = process.argv[2];
if (!outDir) {
  console.error("사용: node scripts/fetch-public-data.mjs <저장폴더>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const PER_PAGE = 10000;

for (const { pk, label } of Object.values(DATASETS)) {
  const headers = { "User-Agent": "Mozilla/5.0", Referer: `https://www.data.go.kr/data/${pk}/standard.do` };
  const meta = await (await fetch(`https://www.data.go.kr/download/columList.json?pk=${pk}&ext=CSV`, { headers })).json();
  const { colNmList, svcTableNm } = meta.tableVO;
  const rows = [];
  // 포털 다운로드는 최대 5만 건까지만 준다
  for (let page = 1; page <= Math.ceil(meta.totalCount / PER_PAGE); page++) {
    const q = new URLSearchParams({ totalCount: meta.totalCount, svcTableNm, perPage: PER_PAGE, page, publicDataPk: pk });
    for (const c of colNmList) q.append("colNmList", c);
    const list = await (await fetch(`https://www.data.go.kr/download/standard.json?${q}`, { headers })).json();
    rows.push(...list);
    if (!list.length) break;
  }
  writeFileSync(join(outDir, `${pk}.json`), JSON.stringify(rows));
  console.log(`${label}(${pk}): ${rows.length}건 저장`);
}
