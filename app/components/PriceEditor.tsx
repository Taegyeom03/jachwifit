"use client";

import { useState, type FormEvent } from "react";
import { isMyPrice, isTemporary, originalPrice, priceLabel, type Food } from "@/lib/foods";

type Props = {
  food: Food;
  onSave: (foodId: number, price: number | null) => void;
  compact?: boolean; // 음식 기록 칸 안에서 한 줄로
};

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

// 내가 산 가격 입력. 묶음으로 샀으면 총 가격 ÷ 몇 회분으로 1회 제공량 가격을 계산한다.
export default function PriceEditor({ food, onSave, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("1");
  const [error, setError] = useState("");

  const mine = isMyPrice(food.priceSource);
  const orig = originalPrice(food.id);
  const t = Number(total);
  const c = Number(count) || 1;
  const perServing = t > 0 && c > 0 ? t / c : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!perServing || perServing > 200000 || c > 100) {
      setError("가격과 개수를 확인해 주세요.");
      return;
    }
    onSave(food.id, perServing);
    setOpen(false);
    setTotal("");
    setCount("1");
    setError("");
  }

  const status = (
    <span className={`source${isTemporary(food.priceSource) ? " temp" : mine ? " mine" : ""}`}>
      {priceLabel(food)}
    </span>
  );

  return (
    <div className={`price-editor${compact ? " compact" : ""}`}>
      <div className="price-line">
        <span>
          {food.servingLabel} <b>{won(food.price)}</b> {status}
        </span>
        <span className="price-actions">
          <button type="button" className="link" onClick={() => setOpen((o) => !o)}>
            {open ? "닫기" : mine ? "가격 고치기" : "내가 산 가격 입력"}
          </button>
          {mine && orig && (
            <button type="button" className="link" onClick={() => onSave(food.id, null)}>
              원래대로({won(orig.price)})
            </button>
          )}
        </span>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="price-form">
          <label>
            산 가격(원)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={total}
              onChange={(e) => {
                setTotal(e.target.value);
                setError("");
              }}
              placeholder="예: 15000"
              autoFocus
            />
          </label>
          <label>
            {food.servingLabel} 몇 개 분량?
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={count}
              onChange={(e) => {
                setCount(e.target.value);
                setError("");
              }}
            />
          </label>
          <button type="submit" className="primary">
            저장
          </button>
          <p className="muted small full">
            {perServing
              ? `${food.servingLabel} 1개 = ${won(perServing)}으로 저장해요.`
              : `묶음으로 샀으면 총 가격과 개수를 넣으면 1개 가격을 계산해요. (예: 10개 15,000원 → 1,500원)`}
          </p>
          {error && <p className="error full">{error}</p>}
        </form>
      )}
    </div>
  );
}
