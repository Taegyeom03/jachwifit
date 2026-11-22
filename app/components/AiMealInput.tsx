"use client";

// 문장으로 식단 기록 (AI). 결과는 바로 저장하지 않고 미리보기에서 고른 것만 기록한다.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { findFood } from "@/lib/foods";
import { MAX_TEXT, type ParsedItem } from "@/lib/mealParse";
import { entryTotals } from "@/lib/nutrition";
import type { Meal } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

type Props = {
  loggedIn: boolean;
  defaultMeal: Meal;
  onAdd: (items: ParsedItem[]) => void;
};

type Preview = { items: (ParsedItem & { checked: boolean })[]; unknown: string[]; remaining?: number };

const amountText = (it: ParsedItem) => {
  if (it.unit === "g") return `${it.amount}g`;
  const f = findFood(it.foodId);
  return `${f?.servingLabel ?? "1회"} × ${it.amount}`;
};

export default function AiMealInput({ loggedIn, defaultMeal, onAdd }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setDone("");
    setPreview(null);
    try {
      const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) {
        setError("로그인하면 AI 기록을 쓸 수 있어요.");
        return;
      }
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, meal: defaultMeal }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "문제가 생겼어요. 잠시 뒤에 다시 해 주세요.");
        return;
      }
      const items = (json.items as ParsedItem[]).map((it) => ({ ...it, checked: true }));
      setPreview({ items, unknown: json.unknown ?? [], remaining: json.remaining });
      if (!items.length) setError("음식을 찾지 못했어요. 위의 검색으로 직접 기록해 주세요.");
    } catch {
      setError("인터넷 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!preview) return;
    const picked = preview.items.filter((i) => i.checked).map(({ checked: _c, ...rest }) => rest);
    if (!picked.length) return;
    onAdd(picked);
    setDone(`${picked.length}개를 기록했어요.`);
    setPreview(null);
    setText("");
  }

  const toggle = (i: number) =>
    setPreview((p) => p && { ...p, items: p.items.map((it, j) => (j === i ? { ...it, checked: !it.checked } : it)) });

  if (!loggedIn) {
    return (
      <section className="panel ai-input">
        <h3>✍️ 문장으로 기록 (AI)</h3>
        <p className="muted small">
          "점심에 제육덮밥이랑 계란 2개 먹음"처럼 적으면 음식과 양을 찾아 줘요. <Link href="/login">로그인</Link>하면 쓸 수
          있어요.
        </p>
      </section>
    );
  }

  const checkedCount = preview?.items.filter((i) => i.checked).length ?? 0;

  return (
    <section className="panel ai-input">
      <h3>✍️ 문장으로 기록 (AI)</h3>
      <form onSubmit={submit} className="ai-form">
        <input
          type="text"
          value={text}
          maxLength={MAX_TEXT}
          placeholder="예: 점심에 학식 제육덮밥, 저녁엔 닭가슴살 200g이랑 밥 반 공기"
          onChange={(e) => setText(e.target.value)}
          aria-label="먹은 음식을 문장으로 입력"
        />
        <button type="submit" className="button primary" disabled={busy || !text.trim()}>
          {busy ? "찾는 중…" : "음식 찾기"}
        </button>
      </form>
      <p className="muted small">
        {text.length}/{MAX_TEXT}자 · 문장은 음식을 찾는 데만 쓰고 저장하지 않아요. AI가 틀릴 수 있으니 기록 전에 확인해 주세요.
      </p>
      {error && <p className="error">{error}</p>}
      {done && <p className="saved small">✓ {done}</p>}

      {preview && preview.items.length > 0 && (
        <div className="ai-preview">
          <p className="small">
            <b>이렇게 기록할까요?</b> 빼고 싶은 건 체크를 풀어 주세요.
          </p>
          <ul>
            {preview.items.map((it, i) => {
              const f = findFood(it.foodId);
              const t = entryTotals({ id: "p", foodId: it.foodId, amount: it.amount, unit: it.unit, meal: it.meal });
              return (
                <li key={`${it.foodId}-${i}`}>
                  <label className="check">
                    <input type="checkbox" checked={it.checked} onChange={() => toggle(i)} />
                    <span>
                      <b>{it.meal}</b> · {f?.name} <span className="muted small">{amountText(it)}</span>
                    </span>
                  </label>
                  <span className="muted small">{t ? `${Math.round(t.kcal)}kcal · 단백질 ${Math.round(t.protein)}g` : ""}</span>
                </li>
              );
            })}
          </ul>
          {preview.unknown.length > 0 && (
            <p className="muted small">못 찾은 것: {preview.unknown.join(", ")} → 위의 검색으로 비슷한 음식을 골라 주세요.</p>
          )}
          <div className="ai-actions">
            <button type="button" className="button primary" onClick={save} disabled={!checkedCount}>
              {checkedCount}개 기록하기
            </button>
            <button type="button" className="button" onClick={() => setPreview(null)}>
              취소
            </button>
            {typeof preview.remaining === "number" && (
              <span className="muted small">오늘 AI 기록 {preview.remaining}번 남음</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
