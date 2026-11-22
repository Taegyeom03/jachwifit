"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_LEVELS,
  AMDR,
  KDRI_SOURCE,
  WEEKLY_LOSS_OPTIONS,
  calcGoal,
  validateProfile,
  type Profile,
} from "@/lib/goal";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
import { dateKey } from "@/lib/store";
import { accountsEnabled } from "@/lib/supabase";
import { useAppData } from "../useAppData";

type Form = Record<Exclude<keyof Profile, "startDate">, string>;

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
  return Object.fromEntries(
    Object.entries(p)
      .filter(([k]) => k !== "startDate")
      .map(([k, v]) => [k, String(v)]),
  ) as Form;
}

export default function SetupPage() {
  const router = useRouter();
  const { ready, profile, setProfile, saveError, account } = useAppData();
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
    // 체중 · 목표 체중 · 감량 속도가 그대로면 계획 시작일을 유지하고, 바뀌면 오늘부터 새 계획
    const same =
      profile &&
      profile.weightKg === draft.weightKg &&
      profile.targetWeightKg === draft.targetWeightKg &&
      profile.weeklyLossKg === draft.weeklyLossKg;
    setProfile({ ...draft, startDate: same && profile.startDate ? profile.startDate : dateKey(new Date()) });
    router.push("/plan");
  }

  if (!ready) return <p className="muted">불러오는 중…</p>;

  const first = !profile;

  // 활동량 · 감량 속도 · 단백질은 기본값(추천)이 있어 처음에는 접어 둔다
  const advanced = (
    <>
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
    </>
  );

  return (
    <>
      {first ? (
        <>
          <h1>자취핏 시작하기</h1>
          <p className="muted">
            키와 몸무게, 목표 체중만 넣으면 하루에 얼마나 먹으면 되는지, 몇 주면 목표에 닿는지 계산해 드려요.
          </p>
          {accountsEnabled && !account && (
            <p className="panel ok">
              다른 기기에서 쓰던 계정이 있나요? <Link href="/login">로그인</Link>하면 목표와 기록을 그대로 불러와요.
            </p>
          )}
        </>
      ) : (
        <div className="plan-meals-head">
          <h1>목표 설정</h1>
          <Link href="/plan" className="button">
            내 계획 보기
          </Link>
        </div>
      )}
      {!first && <p className="muted">신체 정보와 목표를 입력하면 하루 목표 칼로리와 단백질을 계산해 드려요.</p>}

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
        {first ? (
          <details>
            <summary>더 자세히 설정 (활동량 · 감량 속도 · 단백질, 안 바꿔도 돼요)</summary>
            <div className="form-grid">{advanced}</div>
          </details>
        ) : (
          advanced
        )}

        {error && <p className="error full">{error}</p>}
        {saveError && <p className="error full">이 브라우저에서는 저장할 수 없어요. 시크릿 모드인지 확인해 주세요.</p>}
        <button type="submit" className="primary full">
          {first ? "내 계획 보기" : "목표 저장하고 계획 보기"}
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

          <h3 className="sub">계산 과정</h3>
          <ul className="formula">
            <li>
              기초대사량 = 10×{draft.weightKg} + 6.25×{draft.heightCm} − 5×{draft.age}{" "}
              {draft.sex === "male" ? "+ 5" : "− 161"} = <b>{fmt(goal.bmr)}kcal</b>
            </li>
            <li>
              하루 소비 = {fmt(goal.bmr)} × {goal.activityFactor} ({ACTIVITY_LEVELS[draft.activity].label}) ={" "}
              <b>{fmt(goal.tdee)}kcal</b>
            </li>
            <li>
              목표 섭취 = {fmt(goal.tdee)} − {fmt(goal.wantDeficit)} (주 {draft.weeklyLossKg}kg × 7,700 ÷ 7)
              {goal.floorApplied ? ` → 기초대사량 ${fmt(goal.bmr)} 아래라 기초대사량으로` : ""} ={" "}
              <b>{fmt(goal.targetKcal)}kcal</b>
            </li>
            <li>
              목표 단백질 = {draft.weightKg}kg × {draft.proteinPerKg}g = <b>{fmt(goal.targetProtein)}g</b>
            </li>
            {goal.weeks && (
              <li>
                예상 기간 = ({draft.weightKg} − {draft.targetWeightKg})kg × 7,700 ÷ ({fmt(goal.dailyDeficit)} × 7) ={" "}
                <b>약 {goal.weeks}주</b>
              </li>
            )}
          </ul>

          <h3 className="sub">영양소 목표</h3>
          <ul className="formula">
            <li>
              탄수화물 {fmt(goal.targetCarb)}g ({goal.macroPct.carb.toFixed(0)}%) · 단백질 {fmt(goal.targetProtein)}g (
              {goal.macroPct.protein.toFixed(0)}%) · 지방 {fmt(goal.targetFat)}g ({goal.macroPct.fat.toFixed(0)}%)
            </li>
            <li>
              권장 에너지 비율: 탄수화물 {AMDR.carb[0]}~{AMDR.carb[1]}% · 단백질 {AMDR.protein[0]}~{AMDR.protein[1]}% · 지방{" "}
              {AMDR.fat[0]}~{AMDR.fat[1]}% (지방은 25%로 두고, 남은 칼로리를 탄수화물로)
            </li>
            <li>
              식이섬유 {goal.targetFiber}g ({draft.sex === "male" ? "남자" : "여자"} {draft.age}세 충분섭취량)
            </li>
          </ul>
          <p className="muted small">
            기초대사량은 Mifflin-St Jeor 공식, 영양소 기준은 {KDRI_SOURCE}이에요. 일반적인 추정치이며 의료 조언이
            아니에요.
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
