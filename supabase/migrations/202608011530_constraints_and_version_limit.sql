-- Migration 2: 에세이 버전 제한 및 미션 상태 제약 강화
-- 적용일: 2026-08-01
-- 목적:
--   1) AI 에세이 버전을 최대 2개로 제한
--   2) generation_count를 0~2로 제한
--   3) missions.status/source를 NOT NULL + 허용값 CHECK로 강화
--
-- 주의:
--   기존에 버전 3 또는 generation_count > 2 데이터가 있으면
--   데이터를 임의 삭제하지 않고 migration을 중단합니다.

begin;

-- ---------------------------------------------------------------------------
-- 1. 기존 데이터 안전성 검사
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from public.essay_versions
    where version_no < 1
       or version_no > 2
  ) then
    raise exception
      'essay_versions에 허용 범위(1~2)를 벗어난 version_no가 있습니다. 해당 데이터를 먼저 검토해주세요.';
  end if;

  if exists (
    select 1
    from public.essays
    where selected_version_no is not null
      and (
        selected_version_no < 1
        or selected_version_no > 2
      )
  ) then
    raise exception
      'essays에 허용 범위(1~2)를 벗어난 selected_version_no가 있습니다. 해당 데이터를 먼저 검토해주세요.';
  end if;

  if exists (
    select 1
    from public.essays
    where generation_count < 0
       or generation_count > 2
  ) then
    raise exception
      'essays에 허용 범위(0~2)를 벗어난 generation_count가 있습니다. 해당 데이터를 먼저 검토해주세요.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. 에세이 버전 제한: 1~3 -> 1~2
-- ---------------------------------------------------------------------------

alter table public.essay_versions
  drop constraint if exists essay_versions_version_no_check;

alter table public.essay_versions
  add constraint essay_versions_version_no_check
  check (version_no >= 1 and version_no <= 2);

alter table public.essays
  drop constraint if exists essays_selected_version_no_check;

alter table public.essays
  add constraint essays_selected_version_no_check
  check (
    selected_version_no is null
    or (
      selected_version_no >= 1
      and selected_version_no <= 2
    )
  );

alter table public.essays
  drop constraint if exists essays_generation_count_check;

alter table public.essays
  add constraint essays_generation_count_check
  check (generation_count >= 0 and generation_count <= 2);

-- ---------------------------------------------------------------------------
-- 3. missions.status/source 기존 NULL 데이터 보정
-- ---------------------------------------------------------------------------

update public.missions
set status = 'approved'
where status is null;

update public.missions
set source = 'curated'
where source is null;

-- 임의 문자열은 자동 수정하지 않고 migration을 중단합니다.
do $$
begin
  if exists (
    select 1
    from public.missions
    where status not in ('pending', 'approved')
  ) then
    raise exception
      'missions.status에 pending/approved 외 값이 있습니다. 해당 데이터를 먼저 검토해주세요.';
  end if;

  if exists (
    select 1
    from public.missions
    where source not in ('curated', 'ai')
  ) then
    raise exception
      'missions.source에 curated/ai 외 값이 있습니다. 해당 데이터를 먼저 검토해주세요.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. missions.status/source 제약 강화
-- ---------------------------------------------------------------------------

alter table public.missions
  alter column status set default 'approved',
  alter column status set not null,
  alter column source set default 'curated',
  alter column source set not null;

alter table public.missions
  drop constraint if exists missions_status_check;

alter table public.missions
  add constraint missions_status_check
  check (status in ('pending', 'approved'));

alter table public.missions
  drop constraint if exists missions_source_check;

alter table public.missions
  add constraint missions_source_check
  check (source in ('curated', 'ai'));

commit;