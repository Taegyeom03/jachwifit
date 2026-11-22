"use client";

// 그날 몸무게 입력 (오늘 화면 · 캘린더 날짜 상세에서 같이 쓴다)
import Link from "next/link";
import { useState, type FormEvent } from "react";

// 그날 몸무게 기록. 저장하면 내 계획 화면의 "계획 vs 실제" 그래프에 점으로 찍힌다.
export default function WeightInput({
  value,
  label,
  onSave,
  id = "today",
  showPlanLink = true,
}: {
  value?: number;
  label: string;
  onSave: (w: number | null) => void;
  id?: string;
  showPlanLink?: boolean;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const [error, setError] = useState("");
  const num = Number(text);
  const changed = text.trim() !== (value != null ? String(value) : "");

  function save(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      onSave(null);
      setError("");
      return;
    }
    if (!(num >= 30 && num <= 250)) {
      setError("몸무게는 30~250kg 사이로 입력해 주세요.");
      return;
    }
    setError("");
    const w = Math.round(num * 10) / 10;
    setText(String(w));
    onSave(w);
  }

  return (
    <form className="panel weight-input" onSubmit={save} noValidate>
      <label htmlFor={`weight-${id}`}>⚖️ {label}</label>
      <input
        id={`weight-${id}`}
        type="number"
        inputMode="decimal"
        step="any"
        placeholder="예: 72.4"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <span>kg</span>
      <button type="submit" className="button" disabled={!changed}>
        {value != null && !changed ? "저장됨" : "저장"}
      </button>
      {showPlanLink && (
        <Link href="/plan" className="small">
          계획과 비교 →
        </Link>
      )}
      {error && <p className="error full">{error}</p>}
    </form>
  );
}
