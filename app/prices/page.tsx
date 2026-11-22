"use client";

import { useState } from "react";
import { FOODS, isMyPrice, isTemporary } from "@/lib/foods";
import PriceEditor from "../components/PriceEditor";
import { useAppData } from "../useAppData";

type Filter = "temp" | "mine" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "temp", label: "임시값" },
  { key: "mine", label: "내가 입력" },
  { key: "all", label: "전체" },
];

// 내가 산 가격 입력: 공공데이터에 없어 임시값인 가격을 내 실제 가격으로 바꾼다
export default function PricesPage() {
  const { ready, setMyPrice, saveError } = useAppData();
  const [filter, setFilter] = useState<Filter>("temp");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  if (!ready) return <p className="muted">불러오는 중…</p>;

  // 저장하면 임시값 목록에서 바로 빠지므로, 무엇을 저장했는지 알려 준다
  function save(foodId: number, price: number | null) {
    setMyPrice(foodId, price);
    const name = FOODS.find((f) => f.id === foodId)?.name ?? "";
    setNotice(
      price == null
        ? `${name} 가격을 원래대로 되돌렸어요.`
        : `${name} ${Math.round(price).toLocaleString("ko-KR")}원으로 저장했어요. [내가 입력]에서 다시 볼 수 있어요.`,
    );
  }

  const tempCount = FOODS.filter((f) => isTemporary(f.priceSource)).length;
  const mineCount = FOODS.filter((f) => isMyPrice(f.priceSource)).length;
  const q = query.replace(/\s/g, "");
  const list = FOODS.filter(
    (f) =>
      (filter === "all" || (filter === "temp" ? isTemporary(f.priceSource) : isMyPrice(f.priceSource))) &&
      (!q || f.name.replace(/\s/g, "").includes(q)),
  );

  return (
    <>
      <h1>내 가격</h1>
      <p className="muted">
        편의점 · 외식 메뉴처럼 공공데이터에 없는 가격은 임시값이에요. 내가 실제로 산 가격을 넣으면 추천 · 식비 · 식단
        예시 · 인사이트가 모두 그 가격으로 바뀌어요.
      </p>

      <div className="stats">
        <div className="stat">
          <span>아직 임시값</span>
          <b>{tempCount}개</b>
        </div>
        <div className="stat strong">
          <span>내가 입력한 가격</span>
          <b>{mineCount}개</b>
        </div>
      </div>

      {notice && (
        <p className="panel ok" role="status">
          {notice}
        </p>
      )}

      <div className="panel">
        <div className="price-toolbar">
          <div className="tabs" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={filter === f.key ? "active" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="음식 이름 검색"
            aria-label="음식 이름 검색"
          />
        </div>

        {list.length ? (
          <ul className="price-list">
            {list.map((f) => (
              <li key={f.id}>
                <b>{f.name}</b>
                <PriceEditor food={f} onSave={save} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {filter === "mine" ? "아직 입력한 가격이 없어요." : filter === "temp" && !q ? "임시값이 하나도 없어요!" : "맞는 음식이 없어요."}
          </p>
        )}
      </div>

      {saveError && <p className="error">이 브라우저에서는 저장할 수 없어요. 시크릿 모드인지 확인해 주세요.</p>}
      <p className="muted small">
        가격은 이 브라우저에만 저장돼요. 이미 적어 둔 기록의 식비도 새 가격으로 다시 계산돼요.
      </p>
    </>
  );
}
