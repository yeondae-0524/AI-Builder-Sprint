begin;

-- 모든 AI 생성 결과를 버전 1, 2, 3, 4 ... 형태로 계속 보존합니다.
-- smallint 상한과 기존 1~2 제약을 제거하고 정수형 양수 버전 번호를 사용합니다.

alter table public.essay_versions
  drop constraint if exists essay_versions_version_no_check;

alter table public.essays
  drop constraint if exists essays_selected_version_no_check;

alter table public.essays
  drop constraint if exists essays_generation_count_check;

alter table public.essay_versions
  alter column version_no type integer
  using version_no::integer;

alter table public.essays
  alter column selected_version_no type integer
  using selected_version_no::integer;

alter table public.essays
  alter column generation_count type integer
  using generation_count::integer;

alter table public.essay_versions
  add constraint essay_versions_version_no_check
  check (version_no >= 1);

alter table public.essays
  add constraint essays_selected_version_no_check
  check (
    selected_version_no is null
    or selected_version_no >= 1
  );

alter table public.essays
  add constraint essays_generation_count_check
  check (generation_count >= 0);

comment on column public.essay_versions.version_no is
  '에세이별 AI 생성 순번. 1부터 시작하며 생성할 때마다 증가한다.';

comment on column public.essays.generation_count is
  '성공한 AI 에세이 생성 누적 횟수. 상한이 없다.';

commit;