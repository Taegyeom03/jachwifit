// POST /api/parse-meal  { text, meal? } → { items, unknown, remaining }
// 문장으로 식단 기록: 로그인한 사용자만, 하루 호출 횟수 제한(DB 함수 ai_take_quota) 안에서 AI(OpenRouter)를 부른다.
// AI 키(OPENROUTER_API_KEY)는 서버 환경변수에만 있고 브라우저로 나가지 않는다.
// 키나 DB 함수가 아직 없으면 503 "준비 중"으로 안전하게 꺼진다.
import { createClient } from "@supabase/supabase-js";
import { FOODS } from "@/lib/foods";
import { AiError, cleanText, parseMealText } from "@/lib/mealParse";
import { MEALS, type Meal } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_READY = "AI 기록은 준비 중이에요. 지금은 위의 검색으로 기록해 주세요.";

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !sbUrl || !sbKey) return fail(503, "not_configured", NOT_READY);

  // 1) 입력 검사 (서버에서 다시 검사한다)
  let body: { text?: unknown; meal?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_json", "요청 형식이 올바르지 않아요.");
  }
  let text: string;
  try {
    text = cleanText(body.text);
  } catch (e) {
    const err = e as AiError;
    return fail(err.status, err.code, err.message);
  }
  const defaultMeal: Meal = MEALS.includes(body.meal as Meal) ? (body.meal as Meal) : "점심";

  // 2) 로그인 확인
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "login_required", "로그인하면 AI 기록을 쓸 수 있어요.");
  const sb = createClient(sbUrl, sbKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return fail(401, "login_required", "로그인이 풀렸어요. 다시 로그인해 주세요.");

  // 3) 하루 호출 횟수 (DB 함수가 없으면 아직 SQL을 실행하지 않은 것 → 준비 중)
  const limit = Math.min(100, Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 20));
  const { data: remaining, error: quotaError } = await sb.rpc("ai_take_quota", { daily_limit: limit });
  if (quotaError) {
    const missing = quotaError.code === "PGRST202" || /ai_take_quota/.test(quotaError.message);
    console.error(`[parse-meal] 호출 횟수 확인 실패: ${quotaError.code ?? ""}`);
    return missing ? fail(503, "not_configured", NOT_READY) : fail(500, "quota_error", "잠시 뒤에 다시 해 주세요.");
  }
  if (typeof remaining === "number" && remaining < 0) {
    return fail(429, "daily_limit", `오늘 AI 기록은 ${limit}번까지예요. 내일 다시 쓸 수 있어요.`);
  }

  // 4) AI 호출
  try {
    const result = await parseMealText({
      text,
      foods: FOODS,
      defaultMeal,
      apiKey,
      model: process.env.OPENROUTER_MODEL,
    });
    return Response.json({ ...result, remaining });
  } catch (e) {
    if (e instanceof AiError) return fail(e.status, e.code, e.message);
    console.error("[parse-meal] 예상하지 못한 오류");
    return fail(500, "unknown", "문제가 생겼어요. 잠시 뒤에 다시 해 주세요.");
  }
}
