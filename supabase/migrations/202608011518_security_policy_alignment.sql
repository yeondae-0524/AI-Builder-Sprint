-- 2026-08-01
-- 공개 에세이/연결 기록/사진 정책 정합성 및 pending 미션 노출 차단

begin;

-- =========================================================
-- 0. 기존 missions NULL 값 최소 보정
-- AI 출처가 명확한 미션은 pending, 나머지는 기존 운영 미션으로 간주한다.
-- 제약조건 강화(NOT NULL/CHECK)는 후속 migration에서 처리한다.
-- =========================================================

update public.missions
set source = 'curated'
where source is null;

update public.missions
set status = case
  when source = 'ai' then 'pending'
  else 'approved'
end
where status is null;

-- =========================================================
-- 1. essays
-- 공개 완료된 에세이만 다른 사용자가 조회할 수 있다.
-- visibility 허용값은 private / anonymous / nickname이다.
-- =========================================================

alter table public.essays enable row level security;

drop policy if exists
  "published essays are readable"
  on public.essays;
create policy
  "published essays are readable"
on public.essays
for select
to public
using (
  visibility in ('anonymous', 'nickname')
  and status = 'completed'
  and published_at is not null
);

drop policy if exists
  "users can read own or shared essays"
  on public.essays;
drop policy if exists
  "users can read own essays"
  on public.essays;
create policy
  "users can read own essays"
on public.essays
for select
to authenticated
using (user_id = auth.uid());

-- =========================================================
-- 2. essay_items
-- 본인 에세이 항목 또는 공개 완료 에세이에 연결된 항목만 조회한다.
-- =========================================================

alter table public.essay_items enable row level security;

drop policy if exists
  "published essay items are readable"
  on public.essay_items;
create policy
  "published essay items are readable"
on public.essay_items
for select
to public
using (
  exists (
    select 1
    from public.essays e
    where e.id = essay_items.essay_id
      and e.visibility in ('anonymous', 'nickname')
      and e.status = 'completed'
      and e.published_at is not null
  )
);

drop policy if exists
  "users can read items of visible essays"
  on public.essay_items;
drop policy if exists
  "users can read items of own essays"
  on public.essay_items;
create policy
  "users can read items of own essays"
on public.essay_items
for select
to authenticated
using (
  exists (
    select 1
    from public.essays e
    where e.id = essay_items.essay_id
      and e.user_id = auth.uid()
  )
);

-- =========================================================
-- 3. records
-- 기록 자체의 visibility만으로 독립 공개하지 않는다.
-- 본인 기록 또는 공개 완료 에세이에 실제 연결된 기록만 조회한다.
-- =========================================================

alter table public.records enable row level security;

drop policy if exists
  "published essay source records are readable"
  on public.records;
create policy
  "published essay source records are readable"
on public.records
for select
to public
using (
  exists (
    select 1
    from public.essay_items ei
    join public.essays e
      on e.id = ei.essay_id
    where ei.record_id = records.id
      and e.visibility in ('anonymous', 'nickname')
      and e.status = 'completed'
      and e.published_at is not null
  )
);

drop policy if exists
  "users can read own or shared records"
  on public.records;
drop policy if exists
  "users can read own records"
  on public.records;
create policy
  "users can read own records"
on public.records
for select
to authenticated
using (user_id = auth.uid());

-- =========================================================
-- 4. record_photos metadata
-- 본인 사진 메타데이터 또는 공개 완료 에세이에 연결된 사진만 조회한다.
-- =========================================================

alter table public.record_photos enable row level security;

drop policy if exists
  "published essay source photos are readable"
  on public.record_photos;
create policy
  "published essay source photos are readable"
on public.record_photos
for select
to public
using (
  exists (
    select 1
    from public.essay_items ei
    join public.essays e
      on e.id = ei.essay_id
    where ei.record_id = record_photos.record_id
      and e.visibility in ('anonymous', 'nickname')
      and e.status = 'completed'
      and e.published_at is not null
  )
);

drop policy if exists
  "users can read photos of visible records"
  on public.record_photos;
drop policy if exists
  "users can read photos of own records"
  on public.record_photos;
create policy
  "users can read photos of own records"
on public.record_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.records r
    where r.id = record_photos.record_id
      and r.user_id = auth.uid()
  )
);

-- =========================================================
-- 5. missions
-- 일반 사용자는 활성화된 approved 미션만 조회한다.
-- =========================================================

alter table public.missions enable row level security;

drop policy if exists
  "authenticated users can read missions"
  on public.missions;
create policy
  "authenticated users can read missions"
on public.missions
for select
to authenticated
using (
  is_active = true
  and status = 'approved'
);

-- SECURITY DEFINER RPC도 RLS를 우회하므로 approved 검사를 직접 추가한다.
create or replace function public.select_mission(
  p_journey_id uuid,
  p_mission_id uuid,
  p_place_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_requires_place boolean;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  perform 1
  from public.journeys
  where id = p_journey_id
    and user_id = v_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception '진행 중인 본인의 Journey를 찾을 수 없습니다.';
  end if;

  select requires_place
  into v_requires_place
  from public.missions
  where id = p_mission_id
    and is_active = true
    and status = 'approved';

  if not found then
    raise exception '승인된 활성 미션을 찾을 수 없습니다.';
  end if;

  if coalesce(v_requires_place, false)
    and p_place_id is null
  then
    raise exception '이 미션은 장소 선택이 필요합니다.';
  end if;

  if p_place_id is not null
    and not exists (
      select 1
      from public.places
      where id = p_place_id
    )
  then
    raise exception '선택한 장소를 찾을 수 없습니다.';
  end if;

  select id
  into v_attempt_id
  from public.mission_attempts
  where user_id = v_user_id
    and journey_id = p_journey_id
    and mission_id = p_mission_id
    and status in ('selected', 'started')
  order by created_at desc
  limit 1;

  if found then
    return v_attempt_id;
  end if;

  if exists (
    select 1
    from public.mission_attempts
    where user_id = v_user_id
      and status in ('selected', 'started')
  ) then
    raise exception '이미 진행 중인 미션이 있습니다.';
  end if;

  if exists (
    select 1
    from public.mission_attempts
    where user_id = v_user_id
      and journey_id = p_journey_id
      and mission_id = p_mission_id
      and status = 'completed'
  ) then
    raise exception '이 Journey에서 이미 완료한 미션입니다.';
  end if;

  insert into public.mission_attempts (
    user_id,
    journey_id,
    mission_id,
    place_id,
    status,
    selected_at
  )
  values (
    v_user_id,
    p_journey_id,
    p_mission_id,
    p_place_id,
    'selected',
    now()
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke execute on function
  public.select_mission(uuid, uuid, uuid)
from public, anon;

grant execute on function
  public.select_mission(uuid, uuid, uuid)
to authenticated, service_role;

-- =========================================================
-- 6. Storage record-photos
-- 느슨한 UID 폴더 정책을 제거하고 record 소유권을 확인하는 정책만 유지한다.
-- =========================================================

drop policy if exists
  "record photos insert own"
  on storage.objects;
drop policy if exists
  "record photos update own"
  on storage.objects;
drop policy if exists
  "record photos delete own"
  on storage.objects;
drop policy if exists
  "record photos select shared"
  on storage.objects;

drop policy if exists
  "published essay storage photos are readable"
  on storage.objects;
create policy
  "published essay storage photos are readable"
on storage.objects
for select
to public
using (
  bucket_id = 'record-photos'
  and exists (
    select 1
    from public.record_photos rp
    join public.essay_items ei
      on ei.record_id = rp.record_id
    join public.essays e
      on e.id = ei.essay_id
    where rp.storage_path = storage.objects.name
      and e.visibility in ('anonymous', 'nickname')
      and e.status = 'completed'
      and e.published_at is not null
  )
);

commit;