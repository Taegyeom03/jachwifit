"use client";

import { useState, type FormEvent } from "react";
import { isTemporary, searchFoods, type Food } from "@/lib/foods";
import { MEALS, type Meal, type Unit } from "@/lib/store";
import PriceEditor from "./PriceEditor";

type Props = {
  defaultMeal: Meal;
  onAdd: (foodId: number, amount: number, unit: Unit, meal: Meal) => void;
  onSavePrice?: (foodId: number, price: number | null) => void; // 고른 음식의 가격을 그 자리에서 고친다
  frequent?: Food[]; // 자주 먹는 음식 (누르면 바로 고름)
};

// 음식 검색(자동완성) + 양 · 단위 · 끼니 입력
export default function FoodAdder({ defaultMeal, onAdd, onSavePrice, frequent = [] }: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<Unit>("serving");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [error, setError] = useState("");

  const suggestions = picked ? [] : searchFoods(query);

  function pick(food: Food) {
    setPicked(food);
    setQuery(food.name);
    setUnit("serving");
    setAmount("1");
    setError("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!picked) {
      setError("목록에서 음식을 골라 주세요.");
      return;
    }
    if (!(n > 0) || (unit === "serving" && n > 20) || (unit === "g" && n > 3000)) {
      setError("양을 확인해 주세요.");
      return;
    }
    onAdd(picked.id, n, unit, meal);
    setPicked(null);
    setQuery("");
    setAmount("1");
    setError("");
  }

  return (
    // 가격 입력도 form이라 음식 추가 form 밖에 둔다 (form 안에 form을 넣으면 저장이 음식 추가로 처리됨)
    <div className="panel adder">
      <form onSubmit={handleSubmit}>
        {!query && frequent.length > 0 && (
          <div className="chips" aria-label="자주 먹는 음식">
            <span className="muted small">자주 먹는</span>
            {frequent.map((f) => (
              <button key={f.id} type="button" className="chip" onClick={() => pick(f)}>
                {f.name}
              </button>
            ))}
          </div>
        )}
        <div className="search">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
            placeholder="먹은 음식 검색 (예: 닭가슴살)"
            aria-label="음식 검색"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="suggestions" role="listbox">
              {suggestions.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => pick(f)}>
                    <b>{f.name}</b>
                    <span>
                      {f.servingLabel} · {f.kcal}kcal · 단백질 {f.protein}g · {f.price.toLocaleString("ko-KR")}원
                      {isTemporary(f.nutritionSource) && " · 영양 임시값"}
                      {isTemporary(f.priceSource) && " · 가격 임시값"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query && !picked && suggestions.length === 0 && (
            <p className="muted small">찾는 음식이 아직 데이터에 없어요.</p>
          )}
        </div>
  
        <div className="adder-row">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="양"
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="단위">
            <option value="serving">{picked ? `× ${picked.servingLabel}` : "인분"}</option>
            <option value="g">g</option>
          </select>
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} aria-label="끼니">
            {MEALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <button type="submit" className="primary">
            추가
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
      {picked && onSavePrice && <PriceEditor food={picked} onSave={onSavePrice} compact />}
    </div>
  );
}
