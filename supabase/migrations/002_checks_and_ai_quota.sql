-- 002 · 기록 형식 검사(서버 입력 검증) + AI 하루 호출 제한
-- Supabase 대시보드 → SQL Editor에 통째로 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 기존 행은 검사하지 않고(NOT VALID) 앞으로 들어오는 값만 검사한다.

-- 1) 하루 기록(day_logs): 날짜 범위, 객체 형식, entries는 배열(최대 200개), 한 줄 크기 64KB 이하
alter table public.day_logs drop constraint if exists day_logs_day_range;
alter table public.day_logs add constraint day_logs_day_range
  check (day between date '2020-01-01' and date '2100-12-31') not valid;

alter table public.day_logs drop constraint if exists day_logs_log_shape;
alter table public.day_logs add constraint day_logs_log_shape
  check (
    jsonb_typeof(log) = 'object'
    and jsonb_typeof(log -> 'entries') = 'array'
    and jsonb_array_length(log -> 'entries') <= 200
    and (log -> 'weight' is null or (jsonb_typeof(log -> 'weight') = 'number' and (log ->> 'weight')::numeric between 30 and 250))
  ) not valid;

alter table public.day_logs drop constraint if exists day_logs_log_size;
alter table public.day_logs add constraint day_logs_log_size
  check (pg_column_size(log) <= 65536) not valid;

-- 2) 목표 · 내 가격(user_state): 객체 형식, 크기 제한
alter table public.user_state drop constraint if exists user_state_shape;
alter table public.user_state add constraint user_state_shape
  check (
    (profile is null or jsonb_typeof(profile) = 'object')
    and jsonb_typeof(prices) = 'object'
    and pg_column_size(profile) <= 8192
    and pg_column_size(prices) <= 65536
  ) not valid;

-- 3) AI 하루 호출 횟수: 사용자 × 날짜(한국 시간) 한 줄. 표는 직접 읽고 쓸 수 없고 아래 함수로만 센다.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- 정책을 만들지 않아 로그인한 사용자도 표를 직접 읽거나 고칠 수 없다.

-- 호출 1번을 쓴다. 한도 안이면 남은 횟수(0 이상), 넘었으면 -1을 돌려준다.
create or replace function public.ai_take_quota(daily_limit int default 20)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Seoul')::date;
  used int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- 한도는 1~100 사이로만 (클라이언트가 큰 값을 보내도 무시)
  daily_limit := least(greatest(coalesce(daily_limit, 20), 1), 100);

  insert into public.ai_usage as u (user_id, day, count)
  values (uid, today, 1)
  on conflict (user_id, day) do update set count = u.count + 1
    where u.count < daily_limit
  returning count into used;

  if used is null then
    return -1; -- 이미 한도에 닿음
  end if;
  return daily_limit - used;
end;
$$;

revoke all on function public.ai_take_quota(int) from public, anon;
grant execute on function public.ai_take_quota(int) to authenticated;
