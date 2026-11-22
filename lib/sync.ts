// 계정 동기화: 이 기기의 브라우저 저장소 ↔ Supabase(user_state · day_logs)
// - 고칠 때마다 이 기기에 먼저 저장하고, 로그인돼 있으면 계정에도 올린다. 못 올리면 dirty로 표시해 다음에 다시 올린다.
// - 화면이 열릴 때 · 앱으로 돌아올 때 계정에서 받아 와 날짜별로 더 최근 것을 쓴다.
// - 로그인 전에 쓰던 기록은 처음 로그인할 때 계정으로 옮긴다. 다른 계정 데이터가 남아 있으면 지우고 받는다.
import type { Profile } from "./goal";
import {
  clearLocal,
  loadLogs,
  loadMeta,
  loadMyPrices,
  loadProfile,
  saveLogs,
  saveMeta,
  saveMyPrices,
  saveProfile,
  type DayLog,
  type Logs,
  type MyPrices,
} from "./store";
import { getSupabase } from "./supabase";

export type LocalData = { profile: Profile | null; logs: Logs; prices: MyPrices };

export async function currentUser(): Promise<{ id: string; email: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? "" } : null;
}

const toMs = (t: string | null | undefined) => (t ? Date.parse(t) : 0);
const toIso = (ms: number | undefined) => new Date(ms || Date.now()).toISOString();

function markDirtyDay(key: string, dirty: boolean) {
  const meta = loadMeta();
  const set = new Set(meta.dirtyDays ?? []);
  if (dirty) set.add(key);
  else set.delete(key);
  saveMeta({ ...meta, dirtyDays: [...set] });
}

// 하루 기록 하나를 계정에 올린다
export async function pushDay(key: string, day: DayLog): Promise<boolean> {
  const sb = getSupabase();
  const user = await currentUser();
  if (!sb || !user) return false;
  const { error } = await sb
    .from("day_logs")
    .upsert({ user_id: user.id, day: key, log: day, updated_at: toIso(day.updatedAt) });
  markDirtyDay(key, Boolean(error));
  return !error;
}

// 목표 · 내 가격을 계정에 올린다
export async function pushState(): Promise<boolean> {
  const sb = getSupabase();
  const user = await currentUser();
  if (!sb || !user) return false;
  const meta = loadMeta();
  const { error } = await sb.from("user_state").upsert({
    user_id: user.id,
    profile: loadProfile(),
    profile_updated_at: meta.profileAt ? toIso(meta.profileAt) : null,
    prices: loadMyPrices(),
    prices_updated_at: meta.pricesAt ? toIso(meta.pricesAt) : null,
  });
  saveMeta({ ...loadMeta(), dirtyState: Boolean(error) });
  return !error;
}

export type SyncResult =
  | { status: "off" } // 계정 기능 꺼짐 또는 로그인 안 함
  | { status: "ok"; data: LocalData; uploadedDays: number; migrated: boolean }
  | { status: "error"; message: string };

let pulling: Promise<SyncResult> | null = null;

// 계정에서 받아 와 이 기기 데이터와 합친다. 동시에 여러 번 불려도 한 번만 돈다.
export function syncNow(): Promise<SyncResult> {
  pulling ??= doSync().finally(() => {
    pulling = null;
  });
  return pulling;
}

async function doSync(): Promise<SyncResult> {
  const sb = getSupabase();
  const user = await currentUser();
  if (!sb || !user) return { status: "off" };

  // 이 기기에 다른 계정 데이터가 남아 있으면 섞지 않고 지운다
  let meta = loadMeta();
  if (meta.userId && meta.userId !== user.id) {
    clearLocal();
    meta = {};
  }
  const migrated = !meta.userId; // 로그인 전에 쓰던 데이터를 이 계정으로 처음 합치는 중

  const [stateRes, daysRes] = await Promise.all([
    sb.from("user_state").select("*").eq("user_id", user.id).maybeSingle(),
    sb.from("day_logs").select("day, log, updated_at").eq("user_id", user.id),
  ]);
  if (stateRes.error || daysRes.error) {
    return { status: "error", message: (stateRes.error ?? daysRes.error)!.message };
  }

  // 목표 · 가격: 더 최근에 고친 쪽 (이 기기 시각이 없으면 계정 쪽)
  let profile = loadProfile();
  let prices = loadMyPrices();
  let profileAt = meta.profileAt ?? 0;
  let pricesAt = meta.pricesAt ?? 0;
  let stateToPush = Boolean(meta.dirtyState);
  const remote = stateRes.data as {
    profile: Profile | null;
    profile_updated_at: string | null;
    prices: MyPrices | null;
    prices_updated_at: string | null;
  } | null;

  if (remote?.profile && (!profile || toMs(remote.profile_updated_at) >= profileAt)) {
    profile = remote.profile;
    profileAt = toMs(remote.profile_updated_at);
  } else if (profile) stateToPush = true;

  // 가격은 비어 있는 것도 의미가 있다 (다른 기기에서 전부 원래대로 되돌림) → 내용 대신 고친 시각으로 고른다
  if (remote?.prices_updated_at && toMs(remote.prices_updated_at) >= pricesAt) {
    prices = remote.prices ?? {};
    pricesAt = toMs(remote.prices_updated_at);
  } else if (pricesAt || Object.keys(prices).length) stateToPush = true;

  // 하루 기록: 날짜마다 더 최근 것
  const logs = loadLogs();
  const remoteDays = new Map(
    (daysRes.data as { day: string; log: DayLog; updated_at: string }[]).map((r) => [r.day, r]),
  );
  const toPush: string[] = [];
  for (const [day, r] of remoteDays) {
    const local = logs[day];
    const rAt = toMs(r.updated_at);
    if (!local || rAt >= (local.updatedAt ?? 0)) logs[day] = { ...r.log, updatedAt: rAt };
    else toPush.push(day);
  }
  for (const day of Object.keys(logs)) {
    if (!remoteDays.has(day) && (logs[day].entries.length || logs[day].weight != null)) toPush.push(day);
  }
  for (const day of meta.dirtyDays ?? []) if (!toPush.includes(day) && logs[day]) toPush.push(day);

  // 이 기기에 저장
  if (profile) saveProfile(profile);
  saveMyPrices(prices);
  saveLogs(logs);
  saveMeta({ ...loadMeta(), userId: user.id, profileAt, pricesAt, lastSyncAt: Date.now() });

  // 이 기기에만 있던 것 · 더 최근 것을 계정에 올린다
  if (stateToPush) await pushState();
  let uploadedDays = 0;
  if (toPush.length) {
    const rows = toPush.map((day) => ({
      user_id: user.id,
      day,
      log: logs[day],
      updated_at: toIso(logs[day].updatedAt),
    }));
    const { error } = await sb.from("day_logs").upsert(rows);
    saveMeta({ ...loadMeta(), dirtyDays: error ? toPush : [] });
    if (!error) uploadedDays = toPush.length;
  } else {
    saveMeta({ ...loadMeta(), dirtyDays: [] });
  }

  return { status: "ok", data: { profile, logs, prices }, uploadedDays, migrated: migrated && uploadedDays > 0 };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  clearLocal(); // 같은 기기를 다른 사람이 쓸 수 있으니 이 기기 데이터는 지운다 (계정에는 남아 있다)
}

// 회원 탈퇴: 계정과 계정에 저장된 모든 기록을 지운다
export async function deleteAccount(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "계정 기능이 꺼져 있어요.";
  const { error } = await sb.rpc("delete_my_account");
  if (error) return error.message;
  await sb.auth.signOut();
  clearLocal();
  return null;
}
