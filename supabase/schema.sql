-- 자취핏 계정 연동용 DB (Supabase SQL Editor에 통째로 붙여 넣고 Run)
-- 이 파일을 실행한 뒤 supabase/migrations/ 의 파일도 번호 순서대로 실행한다 (002: 입력 검사 · AI 호출 제한)
-- 사용자마다 자기 데이터만 읽고 쓸 수 있다 (Row Level Security).

-- 목표(프로필)와 내 가격: 사용자당 한 줄
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb,
  profile_updated_at timestamptz,
  prices jsonb not null default '{}'::jsonb,
  prices_updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- 하루 기록: 사용자 × 날짜 한 줄 (두 기기에서 서로 다른 날을 고쳐도 덮어쓰지 않게)
create table if not exists public.day_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  log jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.user_state enable row level security;
alter table public.day_logs enable row level security;

drop policy if exists "본인 목표 · 가격만" on public.user_state;
create policy "본인 목표 · 가격만" on public.user_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "본인 기록만" on public.day_logs;
create policy "본인 기록만" on public.day_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_state, public.day_logs to authenticated;

-- 회원 탈퇴: 로그인한 본인 계정만 지운다. 위 두 표는 on delete cascade로 같이 지워진다.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
