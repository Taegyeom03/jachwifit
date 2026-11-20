"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_LEVELS,
  WEEKLY_LOSS_OPTIONS,
  calcGoal,
  validateProfile,
  type Profile,
} from "@/lib/goal";
import { useAppData } from "../useAppData";

type Form = Record<keyof Profile, string>;

const DEFAULT_FORM: Form = {
  heightCm: "",
  age: "",
  sex: "male",
  weightKg: "",
  targetWeightKg: "",
  activity: "1",
  proteinPerKg: "1.4",
  weeklyLossKg: "0.5",
};

function toProfile(f: Form): Profile {
  return {
    heightCm: Number(f.heightCm),
    age: Number(f.age),
    sex: f.sex === "female" ? "female" : "male",
    weightKg: Number(f.weightKg),
    targetWeightKg: Number(f.targetWeightKg),
    activity: Number(f.activity),
    proteinPerKg: Number(f.proteinPerKg),
    weeklyLossKg: Number(f.weeklyLossKg),
  };
}

function toForm(p: Profile): Form {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Form;
}

export default function SetupPage() {
  const router = useRouter();
  const { ready, profile, setProfile, saveError } = useAppData();
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) setForm(toForm(profile));
  }, [profile]);

  const draft = toProfile(form);
  const draftError = validateProfile(draft);
  const goal = draftError ? null : calcGoal(draft);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (draftError) {
      setError(draftError);
      return;
    }
    setProfile(draft);
    router.push("/");
  }

  if (!ready) return <p className="muted">불러오는 중…</p>;

  return (
    <>
      <h1>목표 설정</h1>
      <p className="muted">신체 정보와 목표를 입력하면 하루 목표 칼로리와 단백질을 계산해 드려요.</p>

      <form onSubmit={handleSubmit} className="panel form-grid">
        <label>
          성별
          <select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </label>
        <label>
          나이
          <input type="number" inputMode="numeric" value={form.age} onChange={(e) => set("age", e.target.value)} />
        </label>
        <label>
          키 (cm)
          <input
            type="number"
            inputMode="decimal"
            value={form.heightCm}
            onChange={(e) => set("heightCm", e.target.value)}
          />
        </label>
        <label>
          현재 체중 (kg)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={form.weightKg}
            onChange={(e) => set("weightKg", e.target.value)}
          />
        </label>
        <label>
          목표 체중 (kg)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={form.targetWeightKg}
            onChange={(e) => set("targetWeightKg", e.target.value)}
          />
        </label>
        <label>
          활동량
          <select value={form.activity} onChange={(e) => set("activity", e.target.value)}>
            {ACTIVITY_LEVELS.map((a, i) => (
              <option key={a.label} value={i}>
                {a.label} ({a.detail})
              </option>
            ))}
          </select>
        </label>
        <label>
          감량 속도
          <select value={form.weeklyLossKg} onChange={(e) => set("weeklyLossKg", e.target.value)}>
            {WEEKLY_LOSS_OPTIONS.map((w) => (
              <option key={w} value={w}>
                주당 {w}kg{w === 0.5 ? " (추천)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          단백질 (체중 1kg당 g)
          <select value={form.proteinPerKg} onChange={(e) => set("proteinPerKg", e.target.value)}>
            {["1.2", "1.3", "1.4", "1.5", "1.6"].map((v) => (
              <option key={v} value={v}>
                {v}g{v === "1.4" ? " (기본)" : ""}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error full">{error}</p>}
        {saveError && <p className="error full">이 브라우저에서는 저장할 수 없어요. 시크릿 모드인지 확인해 주세요.</p>}
        <button type="submit" className="primary full">
          {profile ? "목표 저장" : "저장하고 시작하기"}
        </button>
      </form>

      {goal && (
        <section className="panel">
          <h2>계산 결과</h2>
          <div className="stats">
            <Stat label="하루 목표 칼로리" value={`${Math.round(goal.targetKcal)} kcal`} strong />
            <Stat label="하루 목표 단백질" value={`${Math.round(goal.targetProtein)} g`} strong />
            <Stat label="예상 기간" value={goal.weeks ? `약 ${goal.weeks}주` : "-"} strong />
            <Stat label="기초대사량 (BMR)" value={`${Math.round(goal.bmr)} kcal`} />
            <Stat label="하루 소비 칼로리 (TDEE)" value={`${Math.round(goal.tdee)} kcal`} />
            <Stat label="예상 감량" value={`주당 ${goal.weeklyLossKg.toFixed(2)} kg`} />
          </div>
          {goal.warnings.map((w) => (
            <p key={w} className="warning">
              {w}
            </p>
          ))}
          <p className="muted small">
            기초대사량은 Mifflin-St Jeor 공식, 1kg = 7,700kcal로 계산했어요. 일반적인 추정치이며 의료 조언이 아니에요.
          </p>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`stat${strong ? " strong" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
