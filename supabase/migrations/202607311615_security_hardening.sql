-- 2026-07-31
-- places 쓰기 정책 및 SECURITY DEFINER RPC 실행 권한 강화

begin;

-- =========================================================
-- 1. places
-- 로그인 사용자는 장소를 조회하고 새 장소만 추가할 수 있다.
-- 기존 장소의 UPDATE / DELETE 정책은 만들지 않는다.
-- =========================================================

alter table public.places enable row level security;

drop policy if exists
  "authenticated users can insert places"
  on public.places;

create policy
  "authenticated users can insert places"
on public.places
for insert
to authenticated
with check (
  auth.uid() is not null
  and length(trim(kakao_place_id)) > 0
  and length(trim(name)) > 0
  and latitude between -90 and 90
  and longitude between -180 and 180
);

-- =========================================================
-- 2. SECURITY DEFINER RPC
-- PUBLIC 및 anon 실행 권한을 제거하고,
-- authenticated / service_role만 실행하도록 제한한다.
-- =========================================================

revoke execute on function
  public.cancel_mission(uuid)
from public, anon;

grant execute on function
  public.cancel_mission(uuid)
to authenticated, service_role;


revoke execute on function
  public.complete_mission_with_record(
    uuid,
    text,
    text,
    text,
    uuid
  )
from public, anon;

grant execute on function
  public.complete_mission_with_record(
    uuid,
    text,
    text,
    text,
    uuid
  )
to authenticated, service_role;


revoke execute on function
  public.create_essay_draft(uuid, text)
from public, anon;

grant execute on function
  public.create_essay_draft(uuid, text)
to authenticated, service_role;


revoke execute on function
  public.save_essay_ai_result(
    uuid,
    text,
    jsonb
  )
from public, anon;

grant execute on function
  public.save_essay_ai_result(
    uuid,
    text,
    jsonb
  )
to authenticated, service_role;


revoke execute on function
  public.select_mission(
    uuid,
    uuid,
    uuid
  )
from public, anon;

grant execute on function
  public.select_mission(
    uuid,
    uuid,
    uuid
  )
to authenticated, service_role;


revoke execute on function
  public.start_mission(uuid)
from public, anon;

grant execute on function
  public.start_mission(uuid)
to authenticated, service_role;


-- 앞으로 postgres 역할이 public 스키마에 만드는 함수가
-- PUBLIC에 자동 공개되지 않도록 기본 권한을 제한한다.
alter default privileges
for role postgres
in schema public
revoke execute on functions from public;

commit;