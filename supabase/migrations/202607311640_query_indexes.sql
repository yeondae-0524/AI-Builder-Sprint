-- 2026-07-31
-- 앱의 실제 조회 패턴에 맞춘 보조 인덱스

begin;

-- 사용자별 Journey 목록 및 상태별 최신 Journey 조회
create index if not exists
  idx_journeys_user_status_created_at
on public.journeys (
  user_id,
  status,
  created_at desc
);

-- 사용자·Journey·상태별 미션 시도 조회
create index if not exists
  idx_mission_attempts_user_journey_status_created_at
on public.mission_attempts (
  user_id,
  journey_id,
  status,
  created_at desc
);

-- 내 전체 기록 및 월별 기록을 최신순으로 조회
create index if not exists
  idx_records_user_recorded_at
on public.records (
  user_id,
  recorded_at desc
);

-- 특정 Journey의 기록을 시간순으로 조회
create index if not exists
  idx_records_journey_recorded_at
on public.records (
  journey_id,
  recorded_at asc
);

-- 사용자별 에세이 목록을 최신순으로 조회
create index if not exists
  idx_essays_user_created_at
on public.essays (
  user_id,
  created_at desc
);

commit;