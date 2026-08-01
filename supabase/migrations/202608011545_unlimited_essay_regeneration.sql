begin;

-- 다시 만들기 횟수는 제한하지 않되 음수는 허용하지 않습니다.
alter table public.essays
  drop constraint if exists essays_generation_count_check;

alter table public.essays
  add constraint essays_generation_count_check
  check (generation_count >= 0);

comment on column public.essays.generation_count is
  '성공한 AI 에세이 생성 누적 횟수. 버전 수와 별개이며 상한이 없다.';

commit;