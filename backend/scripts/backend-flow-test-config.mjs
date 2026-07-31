import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const TEST_SCENARIOS = {
  week1: {
    label: "1주·기록 4개",
    journeyTitle: "백엔드 통합 테스트 1주 Journey",
    essayTitle: "백엔드 통합 테스트 1주 에세이",
    durationDays: 7,
    targetRecordCount: 4,
  },
  week2: {
    label: "2주·기록 7개",
    journeyTitle: "백엔드 통합 테스트 2주 Journey",
    essayTitle: "백엔드 통합 테스트 2주 에세이",
    durationDays: 14,
    targetRecordCount: 7,
  },
  month1: {
    label: "한 달·기록 15개",
    journeyTitle: "백엔드 통합 테스트 한 달 Journey",
    essayTitle: "백엔드 통합 테스트 한 달 에세이",
    durationDays: 30,
    targetRecordCount: 15,
  },
};

const TEST_SCENARIO_KEY =
  process.argv[2] ?? "week1";

const TEST_SCENARIO =
  TEST_SCENARIOS[TEST_SCENARIO_KEY];

if (!TEST_SCENARIO) {
  throw new Error(
    [
      `지원하지 않는 테스트 시나리오입니다: ${TEST_SCENARIO_KEY}`,
      "사용 가능: week1, week2, month1",
      "예: node backend/scripts/backend-flow-test.mjs week2",
    ].join("\n"),
  );
}

const TEST_JOURNEY_TITLE =
  TEST_SCENARIO.journeyTitle;
const TEST_ESSAY_TITLE =
  TEST_SCENARIO.essayTitle;
const TEST_DURATION_DAYS =
  TEST_SCENARIO.durationDays;
const TEST_TARGET_RECORD_COUNT =
  TEST_SCENARIO.targetRecordCount;
const TEST_LABEL = TEST_SCENARIO.label;

const TEST_RECORD_CONTENTS = [
  "산책길에서 햇빛이 건물 사이로 비치는 모습을 발견했다.",
  "잠시 멈춰 주변의 소리를 들으며 마음이 편안해지는 순간을 기록했다.",
  "평소 지나치던 골목을 천천히 걸으며 새로운 풍경을 발견했다.",
  "오늘의 경험을 돌아보며 아직 설명하기 어려운 감정도 그대로 남겨 두었다.",
  "익숙한 길에서 전에는 눈에 들어오지 않던 간판과 창문을 천천히 살펴봤다.",
  "짧은 시간 동안 휴대전화를 내려놓고 주변의 냄새와 온도에 집중했다.",
  "평소보다 조금 느린 속도로 걸으며 하루의 생각을 정리했다.",
  "가까운 공간에 앉아 들리는 소리를 차례로 적어 보았다.",
  "오늘 눈에 들어온 색과 모양을 사진으로 남기며 순간을 기억했다.",
  "익숙한 장소에서도 시간대가 달라지니 분위기가 다르게 느껴졌다.",
  "작은 선택 하나를 평소와 다르게 해 보고 그때의 기분을 기록했다.",
  "잠깐의 여유 동안 최근 자주 떠오른 생각을 솔직하게 적었다.",
  "주변 사람들의 움직임을 방해하지 않도록 조용히 풍경을 관찰했다.",
  "오늘의 활동에서 좋았던 점과 불편했던 점을 함께 남겼다.",
  "여정 동안 쌓인 장면들을 돌아보며 가장 기억에 남는 순간을 기록했다.",
];

const TEST_EMOTIONS = [
  "joyful",
  "comfortable",
  "new",
  "unsure",
];

const TEST_RECORDS = Array.from(
  { length: TEST_TARGET_RECORD_COUNT },
  (_, index) => ({
    emotion:
      TEST_EMOTIONS[
        index % TEST_EMOTIONS.length
      ],
    content:
      TEST_RECORD_CONTENTS[index] ??
      `${index + 1}번째 백엔드 통합 테스트 기록입니다.`,
  }),
);

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `backend/.env에 ${name} 값이 없습니다.`,
    );
  }

  return value;
}

function throwIfError(label, error) {
  if (!error) {
    return;
  }

  console.error(`\n❌ ${label}`);
  console.error(error);

  throw new Error(
    `${label}: ${error.message ?? "알 수 없는 오류"}`,
  );
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function getSingleRelation(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

const supabaseUrl = getRequiredEnv("SUPABASE_URL");

const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error(
    "backend/.env에 SUPABASE_PUBLISHABLE_KEY 또는 SUPABASE_ANON_KEY가 필요합니다.",
  );
}

const testEmail = getRequiredEnv("TEST_USER_EMAIL");
const testPassword = getRequiredEnv(
  "TEST_USER_PASSWORD",
);

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

async function ensureProfile(user) {
  const {
    data: profile,
    error: profileSelectError,
  } = await supabase
    .from("profiles")
    .select("id, nickname")
    .eq("id", user.id)
    .maybeSingle();

  throwIfError(
    "프로필 조회 실패",
    profileSelectError,
  );

  if (profile) {
    console.log("✅ 프로필 조회 성공");
    return profile;
  }

  const {
    data: createdProfile,
    error: profileInsertError,
  } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      nickname: `backend-test-${user.id.slice(0, 8)}`,
    })
    .select("id, nickname")
    .single();

  throwIfError(
    "프로필 생성 실패",
    profileInsertError,
  );

  console.log("✅ 테스트 프로필 생성 성공");

  return createdProfile;
}

async function getJourneyRecordCount(journeyId) {
  const {
    count,
    error,
  } = await supabase
    .from("records")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("journey_id", journeyId);

  throwIfError(
    "Journey 기록 수 조회 실패",
    error,
  );

  return count ?? 0;
}

async function cancelOtherActiveTestJourney(user) {
  const {
    data: activeJourney,
    error: activeJourneyError,
  } = await supabase
    .from("journeys")
    .select(`
      id,
      title,
      status,
      duration_days,
      target_record_count,
      created_at
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "기존 진행 중 Journey 조회 실패",
    activeJourneyError,
  );

  if (!activeJourney) {
    return;
  }

  // 지금 실행하려는 테스트 Journey라면 그대로 이어서 사용
  if (
    activeJourney.title ===
    TEST_JOURNEY_TITLE
  ) {
    return;
  }

  const isBackendTestJourney =
    activeJourney.title?.startsWith(
      "백엔드 통합 테스트",
    );

  // 실제 사용자의 Journey는 자동으로 건드리지 않음
  if (!isBackendTestJourney) {
    throw new Error(
      [
        "테스트 계정에 실제 진행 중인 Journey가 있습니다.",
        `Journey: ${activeJourney.title}`,
        `Journey ID: ${activeJourney.id}`,
        "실제 데이터는 자동으로 중단하지 않습니다.",
      ].join("\n"),
    );
  }

  const {
    data: cancelledJourney,
    error: cancelError,
  } = await supabase
    .from("journeys")
    .update({
      status: "cancelled",
    })
    .eq("id", activeJourney.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id, title, status")
    .single();

  throwIfError(
    "이전 테스트 Journey 중단 실패",
    cancelError,
  );

  console.log(
    `🧹 이전 테스트 Journey 중단: ${cancelledJourney.title}`,
  );
}

async function getOrCreateTestJourney(user) {
  await cancelOtherActiveTestJourney(user);
  
  const {
    data: existingJourney,
    error: journeySelectError,
  } = await supabase
    .from("journeys")
    .select(`
      id,
      title,
      status,
      duration_days,
      target_record_count,
      created_at
    `)
    .eq("user_id", user.id)
    .eq("title", TEST_JOURNEY_TITLE)
    .in("status", ["active", "completed"])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "테스트 Journey 조회 실패",
    journeySelectError,
  );

  if (existingJourney) {
    const recordCount =
      await getJourneyRecordCount(
        existingJourney.id,
      );

    if (
      existingJourney.duration_days !==
        TEST_DURATION_DAYS ||
      existingJourney.target_record_count !==
        TEST_TARGET_RECORD_COUNT
    ) {
      throw new Error(
        "기존 테스트 Journey의 기간 또는 목표 기록 수가 현재 테스트 설정과 다릅니다.",
      );
    }

    if (
      existingJourney.status === "completed" &&
      recordCount !== TEST_TARGET_RECORD_COUNT
    ) {
      throw new Error(
        `완료된 테스트 Journey의 기록 수가 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${recordCount}개`,
      );
    }

    console.log(
      `✅ 기존 테스트 Journey 사용: ${existingJourney.title} (${recordCount}/${TEST_TARGET_RECORD_COUNT})`,
    );

    return existingJourney;
  }

  const startDate = new Date();
  const endDate = new Date(startDate);

  endDate.setUTCDate(
    endDate.getUTCDate() +
      TEST_DURATION_DAYS -
      1,
  );

  const {
    data: createdJourney,
    error: journeyInsertError,
  } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      title: TEST_JOURNEY_TITLE,
      duration_days: TEST_DURATION_DAYS,
      target_record_count:
        TEST_TARGET_RECORD_COUNT,
      start_date: toDateString(startDate),
      end_date: toDateString(endDate),
      status: "active",
    })
    .select(`
      id,
      title,
      status,
      duration_days,
      target_record_count,
      created_at
    `)
    .single();

  throwIfError(
    "테스트 Journey 생성 실패",
    journeyInsertError,
  );

  console.log(
    `✅ ${TEST_LABEL} 테스트 Journey 생성 성공`,
  );

  return createdJourney;
}

export {
  ensureProfile,
  getOrCreateTestJourney,
  getSingleRelation,
  supabase, TEST_DURATION_DAYS,
  TEST_ESSAY_TITLE,
  TEST_LABEL,
  TEST_RECORDS,
  TEST_TARGET_RECORD_COUNT, testEmail,
  testPassword,
  throwIfError
};

