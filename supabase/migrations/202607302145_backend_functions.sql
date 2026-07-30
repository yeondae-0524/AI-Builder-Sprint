-- AI Builder Sprint
-- Supabase RPC migration
-- Generated: 2026-07-30
--
-- 포함 함수:
--   1. select_mission
--   2. start_mission
--   3. cancel_mission
--   4. complete_mission_with_record
--   5. create_essay_draft
--   6. save_essay_ai_result

begin;

-- =========================================================
-- 1. 미션 선택
-- =========================================================

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
    and is_active = true;

  if not found then
    raise exception '활성화된 미션을 찾을 수 없습니다.';
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

  -- 같은 Journey에서 같은 미션을 이미 선택하거나 시작했다면
  -- 기존 시도 ID를 그대로 반환한다.
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

  -- 다른 활성 미션이 있으면 새 미션을 선택할 수 없다.
  if exists (
    select 1
    from public.mission_attempts
    where user_id = v_user_id
      and status in ('selected', 'started')
  ) then
    raise exception '이미 진행 중인 미션이 있습니다.';
  end if;

  -- 같은 Journey에서 완료한 미션은 다시 선택하지 않는다.
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

revoke all
on function public.select_mission(uuid, uuid, uuid)
from public;

grant execute
on function public.select_mission(uuid, uuid, uuid)
to authenticated;


-- =========================================================
-- 2. 미션 시작
-- =========================================================

create or replace function public.start_mission(
  p_attempt_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_journey_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select journey_id, status
  into v_journey_id, v_status
  from public.mission_attempts
  where id = p_attempt_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception '미션 시도를 찾을 수 없거나 권한이 없습니다.';
  end if;

  if v_status = 'started' then
    return p_attempt_id;
  end if;

  if v_status <> 'selected' then
    raise exception '선택 상태의 미션만 시작할 수 있습니다.';
  end if;

  perform 1
  from public.journeys
  where id = v_journey_id
    and user_id = v_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception '진행 중인 Journey를 찾을 수 없습니다.';
  end if;

  update public.mission_attempts
  set
    status = 'started',
    started_at = coalesce(started_at, now())
  where id = p_attempt_id
    and user_id = v_user_id;

  return p_attempt_id;
end;
$$;

revoke all
on function public.start_mission(uuid)
from public;

grant execute
on function public.start_mission(uuid)
to authenticated;


-- =========================================================
-- 3. 미션 취소
-- =========================================================

create or replace function public.cancel_mission(
  p_attempt_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select status
  into v_status
  from public.mission_attempts
  where id = p_attempt_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception '미션 시도를 찾을 수 없거나 권한이 없습니다.';
  end if;

  if v_status not in ('selected', 'started') then
    raise exception '선택 또는 시작 상태의 미션만 취소할 수 있습니다.';
  end if;

  if exists (
    select 1
    from public.records
    where mission_attempt_id = p_attempt_id
  ) then
    raise exception '이미 기록이 생성된 미션은 취소할 수 없습니다.';
  end if;

  delete from public.mission_attempts
  where id = p_attempt_id
    and user_id = v_user_id;

  return p_attempt_id;
end;
$$;

revoke all
on function public.cancel_mission(uuid)
from public;

grant execute
on function public.cancel_mission(uuid)
to authenticated;


-- =========================================================
-- 4. 미션 완료 + 기록 생성 + 배지 반영 + Journey 완료
-- =========================================================

create or replace function public.complete_mission_with_record(
  p_mission_attempt_id uuid,
  p_emotion text,
  p_content text,
  p_visibility text default 'private',
  p_place_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_record_id uuid;
  v_journey_id uuid;
  v_mission_id uuid;
  v_attempt_place_id uuid;
  v_effective_place_id uuid;
  v_attempt_status text;
  v_journey_status text;
  v_target_record_count integer;
  v_completed_record_count integer;
  v_requires_place boolean;
  v_badge_ids varchar[];
  v_badge_id varchar;
  v_points_increment integer := 2;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_emotion not in (
    'comfortable',
    'joyful',
    'new',
    'uncomfortable',
    'unsure'
  ) then
    raise exception '올바르지 않은 감정 값입니다.';
  end if;

  if trim(coalesce(p_content, '')) = '' then
    raise exception '기록 내용을 입력해주세요.';
  end if;

  if p_visibility not in (
    'private',
    'anonymous',
    'nickname'
  ) then
    raise exception '올바르지 않은 공개 범위입니다.';
  end if;

  -- 같은 미션 시도로 이미 기록을 만들었다면 기존 기록 ID 반환
  select id
  into v_record_id
  from public.records
  where mission_attempt_id = p_mission_attempt_id
    and user_id = v_user_id
  limit 1;

  if found then
    return v_record_id;
  end if;

  select
    journey_id,
    mission_id,
    place_id,
    status
  into
    v_journey_id,
    v_mission_id,
    v_attempt_place_id,
    v_attempt_status
  from public.mission_attempts
  where id = p_mission_attempt_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception '미션 시도를 찾을 수 없거나 권한이 없습니다.';
  end if;

  if v_attempt_status not in ('selected', 'started') then
    raise exception '선택 또는 시작 상태의 미션만 완료할 수 있습니다.';
  end if;

  select status, target_record_count
  into v_journey_status, v_target_record_count
  from public.journeys
  where id = v_journey_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Journey를 찾을 수 없거나 권한이 없습니다.';
  end if;

  if v_journey_status <> 'active' then
    raise exception '진행 중인 Journey에서만 기록을 만들 수 있습니다.';
  end if;

  select
    requires_place,
    badge_ids
  into
    v_requires_place,
    v_badge_ids
  from public.missions
  where id = v_mission_id
    and is_active = true;

  if not found then
    raise exception '활성화된 미션을 찾을 수 없습니다.';
  end if;

  v_effective_place_id :=
    coalesce(p_place_id, v_attempt_place_id);

  if coalesce(v_requires_place, false)
    and v_effective_place_id is null
  then
    raise exception '이 미션은 장소 정보가 필요합니다.';
  end if;

  if v_effective_place_id is not null
    and not exists (
      select 1
      from public.places
      where id = v_effective_place_id
    )
  then
    raise exception '선택한 장소를 찾을 수 없습니다.';
  end if;

  insert into public.records (
    user_id,
    journey_id,
    mission_attempt_id,
    place_id,
    emotion,
    content,
    visibility,
    recorded_at
  )
  values (
    v_user_id,
    v_journey_id,
    p_mission_attempt_id,
    v_effective_place_id,
    p_emotion,
    trim(p_content),
    p_visibility,
    now()
  )
  returning id into v_record_id;

  update public.mission_attempts
  set
    place_id = v_effective_place_id,
    status = 'completed',
    started_at = coalesce(started_at, now()),
    completed_at = now()
  where id = p_mission_attempt_id
    and user_id = v_user_id;

  -- 미션에 연결된 배지 포인트 반영
  foreach v_badge_id in array
    coalesce(v_badge_ids, array[]::varchar[])
  loop
    insert into public.user_badges (
      user_id,
      badge_id,
      points,
      tier,
      updated_at
    )
    values (
      v_user_id,
      v_badge_id,
      v_points_increment,
      'LOCKED',
      now()
    )
    on conflict (user_id, badge_id)
    do update
    set
      points =
        public.user_badges.points
        + excluded.points,
      updated_at = now();

    update public.user_badges
    set
      tier = case
        when points >= 30 then 'PRISM'
        when points >= 15 then 'GOLD'
        when points >= 7 then 'SILVER'
        when points >= 3 then 'BRONZE'
        else 'LOCKED'
      end,
      updated_at = now()
    where user_id = v_user_id
      and badge_id = v_badge_id;
  end loop;

  select count(*)
  into v_completed_record_count
  from public.records
  where user_id = v_user_id
    and journey_id = v_journey_id;

  if v_completed_record_count >= v_target_record_count then
    update public.journeys
    set status = 'completed'
    where id = v_journey_id
      and user_id = v_user_id
      and status = 'active';
  end if;

  return v_record_id;
end;
$$;

revoke all
on function public.complete_mission_with_record(
  uuid,
  text,
  text,
  text,
  uuid
)
from public;

grant execute
on function public.complete_mission_with_record(
  uuid,
  text,
  text,
  text,
  uuid
)
to authenticated;


-- =========================================================
-- 5. 완료된 Journey로 에세이 초안 생성
-- =========================================================

create or replace function public.create_essay_draft(
  p_journey_id uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_essay_id uuid;
  v_cover_photo_path text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception '에세이 제목이 필요합니다.';
  end if;

  perform 1
  from public.journeys
  where id = p_journey_id
    and user_id = v_user_id
    and status = 'completed'
  for update;

  if not found then
    raise exception '완료된 본인의 Journey를 찾을 수 없습니다.';
  end if;

  select id
  into v_essay_id
  from public.essays
  where journey_id = p_journey_id
    and user_id = v_user_id;

  if found then
    return v_essay_id;
  end if;

  if not exists (
    select 1
    from public.records
    where journey_id = p_journey_id
      and user_id = v_user_id
  ) then
    raise exception '에세이에 넣을 기록이 없습니다.';
  end if;

  select rp.storage_path
  into v_cover_photo_path
  from public.records r
  join public.record_photos rp
    on rp.record_id = r.id
  where r.journey_id = p_journey_id
    and r.user_id = v_user_id
  order by
    rp.is_cover desc,
    r.recorded_at asc,
    r.created_at asc,
    rp.sort_order asc
  limit 1;

  insert into public.essays (
    user_id,
    journey_id,
    title,
    cover_photo_path
  )
  values (
    v_user_id,
    p_journey_id,
    trim(p_title),
    v_cover_photo_path
  )
  returning id into v_essay_id;

  insert into public.essay_items (
    essay_id,
    record_id,
    sort_order
  )
  select
    v_essay_id,
    r.id,
    (
      row_number() over (
        order by
          r.recorded_at asc,
          r.created_at asc,
          r.id asc
      ) - 1
    )::integer
  from public.records r
  where r.journey_id = p_journey_id
    and r.user_id = v_user_id;

  return v_essay_id;
end;
$$;

revoke all
on function public.create_essay_draft(uuid, text)
from public;

grant execute
on function public.create_essay_draft(uuid, text)
to authenticated;


-- =========================================================
-- 6. AI 에세이 제목과 연결 문장 저장
-- =========================================================

create or replace function public.save_essay_ai_result(
  p_essay_id uuid,
  p_title text,
  p_bridges jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_record_index integer;
  v_bridge_text text;
  v_expected_count integer;
  v_seen_indexes integer[] := '{}'::integer[];
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception '에세이 제목이 필요합니다.';
  end if;

  if p_bridges is null
    or jsonb_typeof(p_bridges) <> 'array'
  then
    raise exception '연결 문장은 배열이어야 합니다.';
  end if;

  perform 1
  from public.essays
  where id = p_essay_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception '에세이를 찾을 수 없거나 권한이 없습니다.';
  end if;

  select count(*)
  into v_expected_count
  from public.essay_items
  where essay_id = p_essay_id;

  if v_expected_count = 0 then
    raise exception '에세이에 연결된 기록이 없습니다.';
  end if;

  if jsonb_array_length(p_bridges) <> v_expected_count then
    raise exception
      '연결 문장 개수가 기록 개수와 일치하지 않습니다.';
  end if;

  update public.essays
  set
    title = trim(p_title),
    updated_at = now()
  where id = p_essay_id
    and user_id = v_user_id;

  for v_item in
    select value
    from jsonb_array_elements(p_bridges)
  loop
    if not (v_item ? 'recordIndex')
      or not (v_item ? 'bridgeText')
    then
      raise exception
        'AI 응답에 recordIndex 또는 bridgeText가 없습니다.';
    end if;

    begin
      v_record_index :=
        (v_item ->> 'recordIndex')::integer;
    exception
      when others then
        raise exception 'recordIndex가 올바르지 않습니다.';
    end;

    v_bridge_text :=
      trim(coalesce(v_item ->> 'bridgeText', ''));

    if v_record_index < 0 then
      raise exception
        'recordIndex는 0 이상이어야 합니다.';
    end if;

    if v_record_index = any(v_seen_indexes) then
      raise exception
        '중복된 recordIndex가 있습니다: %',
        v_record_index;
    end if;

    if v_bridge_text = '' then
      raise exception
        '연결 문장은 비워둘 수 없습니다.';
    end if;

    update public.essay_items
    set ai_bridge_text = v_bridge_text
    where essay_id = p_essay_id
      and sort_order = v_record_index;

    if not found then
      raise exception
        'recordIndex에 해당하는 기록이 없습니다: %',
        v_record_index;
    end if;

    v_seen_indexes :=
      array_append(v_seen_indexes, v_record_index);
  end loop;

  return p_essay_id;
end;
$$;

revoke all
on function public.save_essay_ai_result(
  uuid,
  text,
  jsonb
)
from public;

grant execute
on function public.save_essay_ai_result(
  uuid,
  text,
  jsonb
)
to authenticated;

commit;