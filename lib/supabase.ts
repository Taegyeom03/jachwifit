// Supabase 연결. 주소와 공개 키(anon/publishable)는 .env.local · Netlify 환경변수에서 읽는다.
// 둘 중 하나라도 없으면 계정 기능을 끄고, 앱은 지금처럼 이 기기에만 저장해서 동작한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const accountsEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

// 브라우저에서만 만든다 (로그인 세션을 브라우저 저장소에 둔다)
export function getSupabase(): SupabaseClient | null {
  if (!accountsEnabled || typeof window === "undefined") return null;
  client ??= createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

// Supabase 오류 메시지를 화면용 한국어로
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (m.includes("already registered") || m.includes("already been registered")) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (m.includes("email not confirmed")) return "이메일 인증이 아직 안 됐어요. 메일함의 확인 링크를 눌러 주세요.";
  if (m.includes("password should be at least")) return "비밀번호는 6자 이상으로 해 주세요.";
  if (m.includes("unable to validate email") || m.includes("invalid format")) return "이메일 주소를 확인해 주세요.";
  if (m.includes("rate limit") || m.includes("too many")) return "요청이 너무 많아요. 잠시 뒤에 다시 해 주세요.";
  if (m.includes("failed to fetch") || m.includes("network")) return "인터넷 연결을 확인해 주세요.";
  return `문제가 생겼어요: ${message}`;
}
