import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const TEST_JOURNEY_TITLE =
  "백엔드 통합 테스트 1주 Journey";
const TEST_DURATION_DAYS = 7;
const TEST_TARGET_RECORD_COUNT = 4;

const TEST_RECORDS = [
  {
    emotion: "joyful",
    content:
      "산책길에서 햇빛이 건물 사이로 비치는 모습을 발견했다.",
  },
  {
    emotion: "comfortable",
    content:
      "잠시 멈춰 주변의 소리를 들으며 마음이 편안해지는 순간을 기록했다.",
  },
  {
    emotion: "new",
    content:
      "평소 지나치던 골목을 천천히 걸으며 새로운 풍경을 발견했다.",
  },
  {
    emotion: "unsure",
    content:
      "오늘의 경험을 돌아보며 아직 설명하기 어려운 감정도 그대로 남겨 두었다.",
  },
];

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

async function getOrCreateTestJourney(user) {
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
    "✅ 1주·기록 4개 테스트 Journey 생성 성공",
  );

  return createdJourney;
}

async function getCompletedMissionCount(userId) {
  const {
    count,
    error,
  } = await supabase
    .from("mission_attempts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("status", "completed");

  throwIfError(
    "완료 미션 수 조회 실패",
    error,
  );

  return count ?? 0;
}

async function getUsedMissionIds(journeyId) {
  const {
    data,
    error,
  } = await supabase
    .from("mission_attempts")
    .select("mission_id")
    .eq("journey_id", journeyId);

  throwIfError(
    "Journey 사용 미션 조회 실패",
    error,
  );

  return new Set(
    (data ?? []).map(
      (attempt) => attempt.mission_id,
    ),
  );
}

async function getTestPlaceId() {
  const {
    data: place,
    error: placeError,
  } = await supabase
    .from("places")
    .select("id, name")
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  throwIfError("장소 조회 실패", placeError);

  if (!place) {
    throw new Error(
      "장소가 필요한 미션을 선택했지만 places 데이터가 없습니다.",
    );
  }

  console.log(
    `✅ 테스트 장소 선택: ${place.name}`,
  );

  return place.id;
}

async function findAvailableMission(
  user,
  journey,
) {
  const [
    completedMissionCount,
    usedMissionIds,
  ] = await Promise.all([
    getCompletedMissionCount(user.id),
    getUsedMissionIds(journey.id),
  ]);

  const {
    data: missions,
    error: missionError,
  } = await supabase
    .from("missions")
    .select(`
      id,
      title,
      requires_place,
      badge_ids,
      unlock_count
    `)
    .eq("is_active", true)
    .order("requires_place", {
      ascending: true,
    })
    .order("unlock_count", {
      ascending: true,
    })
    .limit(100);

  throwIfError(
    "활성 미션 조회 실패",
    missionError,
  );

  const mission = (missions ?? []).find(
    (candidate) => {
      const unlockCount =
        candidate.unlock_count ?? 0;

      return (
        !usedMissionIds.has(candidate.id) &&
        unlockCount <= completedMissionCount
      );
    },
  );

  if (!mission) {
    throw new Error(
      [
        "현재 선택 가능한 미션이 부족합니다.",
        `완료 미션 수: ${completedMissionCount}`,
        `현재 Journey에서 이미 사용한 미션 수: ${usedMissionIds.size}`,
        "활성 미션의 unlock_count와 중복 제한을 확인해주세요.",
      ].join("\n"),
    );
  }

  const placeId = mission.requires_place
    ? await getTestPlaceId()
    : null;

  console.log(
    `✅ 테스트 미션 선택: ${mission.title}`,
  );

  return {
    mission,
    placeId,
  };
}

async function getActiveAttempt(journeyId) {
  const {
    data,
    error,
  } = await supabase
    .from("mission_attempts")
    .select(`
      id,
      user_id,
      journey_id,
      mission_id,
      place_id,
      status
    `)
    .eq("journey_id", journeyId)
    .in("status", ["selected", "started"])
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "진행 중인 미션 조회 실패",
    error,
  );

  return data;
}

async function createMissionAttempt(
  user,
  journey,
) {
  const existingAttempt =
    await getActiveAttempt(journey.id);

  if (existingAttempt) {
    if (existingAttempt.user_id !== user.id) {
      throw new Error(
        "테스트 Journey의 진행 중 미션 소유자가 로그인 사용자와 다릅니다.",
      );
    }

    console.log(
      `✅ 기존 미션 시도 이어서 사용: ${existingAttempt.id}`,
    );

    return existingAttempt;
  }

  const {
    mission,
    placeId,
  } = await findAvailableMission(
    user,
    journey,
  );

  const {
    data: missionAttemptId,
    error: selectMissionError,
  } = await supabase.rpc("select_mission", {
    p_journey_id: journey.id,
    p_mission_id: mission.id,
    p_place_id: placeId,
  });

  throwIfError(
    "select_mission RPC 실패",
    selectMissionError,
  );

  if (!missionAttemptId) {
    throw new Error(
      "select_mission RPC가 미션 시도 ID를 반환하지 않았습니다.",
    );
  }

  const {
    data: createdAttempt,
    error: createdAttemptError,
  } = await supabase
    .from("mission_attempts")
    .select(`
      id,
      user_id,
      journey_id,
      mission_id,
      place_id,
      status
    `)
    .eq("id", missionAttemptId)
    .single();

  throwIfError(
    "생성된 미션 시도 조회 실패",
    createdAttemptError,
  );

  console.log("✅ 미션 선택 성공");

  return createdAttempt;
}

async function startAttempt(attempt) {
  if (attempt.status === "started") {
    console.log(
      "✅ 미션이 이미 started 상태입니다.",
    );

    return attempt.id;
  }

  const {
    data: missionAttemptId,
    error: startError,
  } = await supabase.rpc("start_mission", {
    p_mission_attempt_id: attempt.id,
  });

  throwIfError(
    "start_mission RPC 실패",
    startError,
  );

  if (!missionAttemptId) {
    throw new Error(
      "start_mission RPC가 미션 시도 ID를 반환하지 않았습니다.",
    );
  }

  console.log("✅ 미션 시작 성공");

  return missionAttemptId;
}

async function completeAttempt(
  attempt,
  recordIndex,
) {
  const recordInput =
    TEST_RECORDS[recordIndex];

  if (!recordInput) {
    throw new Error(
      `${recordIndex + 1}번째 테스트 기록 데이터가 없습니다.`,
    );
  }

  const {
    data: recordId,
    error: completeError,
  } = await supabase.rpc(
    "complete_mission_with_record",
    {
      p_mission_attempt_id: attempt.id,
      p_emotion: recordInput.emotion,
      p_content: recordInput.content,
      p_visibility: "private",
      p_place_id: attempt.place_id,
    },
  );

  throwIfError(
    "complete_mission_with_record RPC 실패",
    completeError,
  );

  if (!recordId) {
    throw new Error(
      "complete_mission_with_record RPC가 기록 ID를 반환하지 않았습니다.",
    );
  }

  console.log(
    `✅ ${recordIndex + 1}번째 기록 생성 성공: ${recordId}`,
  );

  return recordId;
}

async function uploadTestPhoto(
  user,
  recordId,
  sortIndex,
) {
  const {
    data: existingPhoto,
    error: existingPhotoError,
  } = await supabase
    .from("record_photos")
    .select("id, storage_path")
    .eq("record_id", recordId)
    .limit(1)
    .maybeSingle();

  throwIfError(
    "기존 사진 조회 실패",
    existingPhotoError,
  );

  if (existingPhoto) {
    console.log(
      "✅ 이미 사진이 있어 업로드 테스트를 건너뜁니다.",
    );

    return existingPhoto.storage_path;
  }

  // 1x1 PNG 테스트 이미지
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  const pngBuffer = Buffer.from(
    pngBase64,
    "base64",
  );

  const imageArrayBuffer =
    pngBuffer.buffer.slice(
      pngBuffer.byteOffset,
      pngBuffer.byteOffset +
        pngBuffer.byteLength,
    );

  const storagePath =
    `${user.id}/${recordId}/` +
    `backend-flow-${sortIndex + 1}-${Date.now()}.png`;

  const {
    data: uploadedFile,
    error: uploadError,
  } = await supabase.storage
    .from("record-photos")
    .upload(
      storagePath,
      imageArrayBuffer,
      {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      },
    );

  throwIfError(
    "Storage 사진 업로드 실패",
    uploadError,
  );

  const {
    error: photoInsertError,
  } = await supabase
    .from("record_photos")
    .insert({
      record_id: recordId,
      storage_path: uploadedFile.path,
      sort_order: 0,
      is_cover: true,
    });

  if (photoInsertError) {
    await supabase.storage
      .from("record-photos")
      .remove([uploadedFile.path]);

    throwIfError(
      "record_photos 저장 실패",
      photoInsertError,
    );
  }

  console.log(
    `✅ ${sortIndex + 1}번째 기록 사진 업로드 성공`,
  );

  return uploadedFile.path;
}

async function verifyJourneyProgress(
  journeyId,
  expectedRecordCount,
) {
  const [
    journeyResult,
    recordCount,
  ] = await Promise.all([
    supabase
      .from("journeys")
      .select(`
        id,
        status,
        duration_days,
        target_record_count
      `)
      .eq("id", journeyId)
      .single(),
    getJourneyRecordCount(journeyId),
  ]);

  throwIfError(
    "Journey 진행 상태 조회 실패",
    journeyResult.error,
  );

  if (recordCount !== expectedRecordCount) {
    throw new Error(
      `Journey 기록 수가 예상과 다릅니다. 예상: ${expectedRecordCount}, 실제: ${recordCount}`,
    );
  }

  const expectedStatus =
    expectedRecordCount >=
    TEST_TARGET_RECORD_COUNT
      ? "completed"
      : "active";

  if (
    journeyResult.data.status !==
    expectedStatus
  ) {
    throw new Error(
      `Journey 상태가 예상과 다릅니다. 예상: ${expectedStatus}, 실제: ${journeyResult.data.status}`,
    );
  }

  console.log(
    `✅ Journey 진행률 확인: ${recordCount}/${TEST_TARGET_RECORD_COUNT}, 상태 ${journeyResult.data.status}`,
  );

  return journeyResult.data;
}

async function buildFourRecordJourney(
  user,
  journey,
) {
  let recordCount =
    await getJourneyRecordCount(journey.id);

  if (
    journey.status === "completed" &&
    recordCount === TEST_TARGET_RECORD_COUNT
  ) {
    console.log(
      "✅ Journey가 이미 기록 4개로 완료되어 생성 단계를 건너뜁니다.",
    );

    return;
  }

  while (
    recordCount <
    TEST_TARGET_RECORD_COUNT
  ) {
    const attempt =
      await createMissionAttempt(
        user,
        journey,
      );

    await startAttempt(attempt);

    const recordId =
      await completeAttempt(
        attempt,
        recordCount,
      );

    await uploadTestPhoto(
      user,
      recordId,
      recordCount,
    );

    recordCount += 1;

    await verifyJourneyProgress(
      journey.id,
      recordCount,
    );
  }
}
async function verifyFinalResults(
  user,
  journeyId,
) {
  const {
    data: journeyRecords,
    error: journeyRecordsError,
  } = await supabase
    .from("records")
    .select("id")
    .eq("journey_id", journeyId);

  throwIfError(
    "Journey 기록 ID 조회 실패",
    journeyRecordsError,
  );

  const recordIds = (
    journeyRecords ?? []
  ).map((record) => record.id);

  const [
    journeyResult,
    recordsResult,
    attemptsResult,
    badgesResult,
    photosResult,
  ] = await Promise.all([
    supabase
      .from("journeys")
      .select(`
        id,
        title,
        status,
        duration_days,
        target_record_count
      `)
      .eq("id", journeyId)
      .single(),

    supabase
      .from("records")
      .select(`
        id,
        user_id,
        journey_id,
        mission_attempt_id,
        place_id,
        emotion,
        content,
        visibility,
        recorded_at
      `)
      .eq("journey_id", journeyId)
      .order("recorded_at", {
        ascending: true,
      }),

    supabase
      .from("mission_attempts")
      .select(`
        id,
        mission_id,
        status,
        selected_at,
        started_at,
        completed_at
      `)
      .eq("journey_id", journeyId)
      .order("created_at", {
        ascending: true,
      }),

    supabase
      .from("user_badges")
      .select(`
        badge_id,
        points,
        tier
      `)
      .eq("user_id", user.id),

    recordIds.length > 0
      ? supabase
          .from("record_photos")
          .select(`
            id,
            record_id,
            storage_path,
            sort_order,
            is_cover
          `)
          .in("record_id", recordIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  throwIfError(
    "최종 Journey 검증 실패",
    journeyResult.error,
  );

  throwIfError(
    "최종 기록 검증 실패",
    recordsResult.error,
  );

  throwIfError(
    "최종 미션 상태 검증 실패",
    attemptsResult.error,
  );

  throwIfError(
    "최종 배지 검증 실패",
    badgesResult.error,
  );

  throwIfError(
    "최종 사진 검증 실패",
    photosResult.error,
  );

  const records =
    recordsResult.data ?? [];

  const attempts =
    attemptsResult.data ?? [];

  const photos =
    photosResult.data ?? [];

  if (
    journeyResult.data.status !==
    "completed"
  ) {
    throw new Error(
      `Journey 상태가 completed가 아닙니다: ${journeyResult.data.status}`,
    );
  }

  if (
    records.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `최종 기록 수가 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${records.length}개`,
    );
  }

  const recordAttemptIds = new Set(
    records.map(
      (record) =>
        record.mission_attempt_id,
    ),
  );

  const relatedAttempts =
    attempts.filter((attempt) =>
      recordAttemptIds.has(attempt.id),
    );

  if (
    relatedAttempts.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `기록과 연결된 미션 시도 수가 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${relatedAttempts.length}개`,
    );
  }

  if (
    relatedAttempts.some(
      (attempt) =>
        attempt.status !== "completed",
    )
  ) {
    throw new Error(
      "completed가 아닌 미션 시도가 있습니다.",
    );
  }

  if (
    photos.length <
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `사진 수가 기록 수보다 적습니다. 기록: ${records.length}, 사진: ${photos.length}`,
    );
  }

  console.log(
    "\n==============================",
  );
  console.log(
    "🎉 1주·기록 4개 백엔드 통합 테스트 성공",
  );
  console.log(
    "==============================",
  );
  console.log("사용자:", user.id);
  console.log(
    "Journey:",
    journeyResult.data,
  );
  console.log(
    "기록 수:",
    records.length,
  );
  console.log(
    "미션 시도 수:",
    relatedAttempts.length,
  );
  console.log(
    "사진 수:",
    photos.length,
  );
  console.log("기록:", records);
  console.log(
    "배지:",
    badgesResult.data,
  );

  return {
    journey: journeyResult.data,
    records,
    attempts: relatedAttempts,
    photos,
  };
}

async function createEssayDraftAndVerify(
  user,
  journeyId,
) {
  const {
    data: existingEssay,
    error: existingEssayError,
  } = await supabase
    .from("essays")
    .select(`
      id,
      user_id,
      journey_id,
      title,
      cover_photo_path,
      visibility,
      status,
      created_at,
      updated_at
    `)
    .eq("user_id", user.id)
    .eq("journey_id", journeyId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  throwIfError(
    "기존 에세이 조회 실패",
    existingEssayError,
  );

  let essay = existingEssay;

  if (!essay) {
    const {
      data: essayId,
      error: createEssayError,
    } = await supabase.rpc(
      "create_essay_draft",
      {
        p_journey_id: journeyId,
        p_title:
          "백엔드 통합 테스트 1주 에세이",
      },
    );

    throwIfError(
      "create_essay_draft RPC 실패",
      createEssayError,
    );

    if (!essayId) {
      throw new Error(
        "에세이 ID가 반환되지 않았습니다.",
      );
    }

    console.log(
      `✅ 에세이 초안 생성 성공: ${essayId}`,
    );

    const {
      data: createdEssay,
      error: essayError,
    } = await supabase
      .from("essays")
      .select(`
        id,
        user_id,
        journey_id,
        title,
        cover_photo_path,
        visibility,
        status,
        created_at,
        updated_at
      `)
      .eq("id", essayId)
      .eq("user_id", user.id)
      .single();

    throwIfError(
      "생성된 에세이 조회 실패",
      essayError,
    );

    essay = createdEssay;
  } else {
    console.log(
      `✅ 기존 에세이 사용: ${essay.id}`,
    );
  }

  const {
    data: essayItems,
    error: essayItemsError,
  } = await supabase
    .from("essay_items")
    .select(`
      id,
      essay_id,
      record_id,
      ai_bridge_text,
      sort_order,
      created_at
    `)
    .eq("essay_id", essay.id)
    .order("sort_order", {
      ascending: true,
    });

  throwIfError(
    "에세이 기록 연결 조회 실패",
    essayItemsError,
  );

  if (
    !essayItems ||
    essayItems.length !==
      TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `에세이에 연결된 기록 수가 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${essayItems?.length ?? 0}개`,
    );
  }

  if (essay.status !== "draft") {
    throw new Error(
      `에세이 상태가 draft가 아닙니다: ${essay.status}`,
    );
  }

  if (!essay.cover_photo_path) {
    throw new Error(
      "에세이 대표 사진 경로가 없습니다.",
    );
  }

  console.log(
    "✅ 에세이 상세 조회 성공",
  );
  console.log(
    `✅ 연결된 기록 수: ${essayItems.length}`,
  );
  console.log(
    `✅ 대표 사진 경로: ${essay.cover_photo_path}`,
  );

  return {
    essay,
    essayItems,
  };
}
function parseEssayAiResult(rawAnswer) {
  const cleaned = rawAnswer
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace < firstBrace
  ) {
    throw new Error(
      "AI 응답에서 JSON을 찾을 수 없습니다.",
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(
      cleaned.slice(
        firstBrace,
        lastBrace + 1,
      ),
    );
  } catch {
    throw new Error(
      `AI 응답 JSON 변환 실패:\n${rawAnswer}`,
    );
  }

  if (
    typeof parsed.title !== "string" ||
    !parsed.title.trim()
  ) {
    throw new Error(
      "AI 응답에 제목이 없습니다.",
    );
  }

  if (!Array.isArray(parsed.bridges)) {
    throw new Error(
      "AI 응답에 bridges 배열이 없습니다.",
    );
  }

  const bridges = parsed.bridges.map(
    (bridge, index) => {
      if (
        !Number.isInteger(
          bridge.recordIndex,
        ) ||
        typeof bridge.bridgeText !==
          "string" ||
        !bridge.bridgeText.trim()
      ) {
        throw new Error(
          `${index + 1}번째 연결 문장 형식이 잘못됐습니다.`,
        );
      }

      return {
        recordIndex:
          bridge.recordIndex,
        bridgeText:
          bridge.bridgeText.trim(),
      };
    },
  );

  const indexes = bridges.map(
    (bridge) => bridge.recordIndex,
  );

  if (
    new Set(indexes).size !==
    indexes.length
  ) {
    throw new Error(
      "AI 응답의 recordIndex가 중복됐습니다.",
    );
  }

  if (
    indexes.some(
      (index) =>
        index < 0 ||
        index >=
          TEST_TARGET_RECORD_COUNT,
    )
  ) {
    throw new Error(
      "AI 응답의 recordIndex 범위가 잘못됐습니다.",
    );
  }

  return {
    title: parsed.title.trim(),
    bridges,
  };
}

async function generateEssayWithUpstageAndVerify(
  essayId,
) {
  const {
    data: essay,
    error: essayError,
  } = await supabase
    .from("essays")
    .select(`
      id,
      journey_id,
      essay_items (
        id,
        sort_order,
        records (
          id,
          recorded_at,
          emotion,
          content,
          mission_attempts (
            missions (
              title
            )
          ),
          places (
            name
          )
        )
      )
    `)
    .eq("id", essayId)
    .single();

  throwIfError(
    "AI 입력용 에세이 조회 실패",
    essayError,
  );

  const items = [
    ...(essay.essay_items ?? []),
  ].sort(
    (a, b) =>
      a.sort_order - b.sort_order,
  );

  if (
    items.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `AI에 전달할 기록이 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${items.length}개`,
    );
  }

  const recordsText = items
    .map((item, index) => {
      const record =
        getSingleRelation(
          item.records,
        );

      if (!record) {
        throw new Error(
          `${index + 1}번째 essay_item에 연결된 기록이 없습니다.`,
        );
      }

      const missionAttempt =
        getSingleRelation(
          record.mission_attempts,
        );

      const mission =
        getSingleRelation(
          missionAttempt?.missions,
        );

      const place =
        getSingleRelation(
          record.places,
        );

      return [
        `[기록 ${index + 1}]`,
        `날짜: ${record.recorded_at}`,
        `미션: ${
          mission?.title ??
          "미션 정보 없음"
        }`,
        `장소: ${
          place?.name ??
          "장소 정보 없음"
        }`,
        `감정: ${record.emotion}`,
        `내용: ${record.content}`,
      ].join("\n");
    })
    .join("\n\n");

  const prompt = `
다음은 한 사용자가 1주 Journey 동안 작성한 실제 경험 기록 4개입니다.

${recordsText}

위 기록만을 바탕으로 자연스러운 한국어 에세이를 구성하세요.

규칙:
- 기록에 없는 사실을 만들지 마세요.
- 사용자의 감정과 경험을 중심으로 작성하세요.
- 4개의 기록을 시간 순서대로 자연스럽게 이어주세요.
- 각 기록을 소개하거나 이어주는 연결 문장을 하나씩 작성하세요.
- 반드시 JSON만 반환하세요.
- bridges 개수는 반드시 4개여야 합니다.
- recordIndex는 0, 1, 2, 3을 각각 한 번씩 사용하세요.

{
  "title": "에세이 제목",
  "bridges": [
    {
      "recordIndex": 0,
      "bridgeText": "첫 번째 기록을 자연스럽게 소개하는 문장"
    },
    {
      "recordIndex": 1,
      "bridgeText": "두 번째 기록을 앞 기록과 이어주는 문장"
    },
    {
      "recordIndex": 2,
      "bridgeText": "세 번째 기록을 앞 기록과 이어주는 문장"
    },
    {
      "recordIndex": 3,
      "bridgeText": "네 번째 기록을 앞 기록과 이어주며 마무리하는 문장"
    }
  ]
}
`.trim();

  const {
    data: upstageData,
    error: upstageError,
  } = await supabase.functions.invoke(
    "upstage-test",
    {
      body: {
        message: prompt,
      },
    },
  );

  throwIfError(
    "Upstage Edge Function 호출 실패",
    upstageError,
  );

  if (!upstageData?.answer) {
    throw new Error(
      "Upstage 응답에 answer가 없습니다.",
    );
  }

  console.log(
    "✅ Upstage AI 응답 수신 성공",
  );

  console.log(
    "AI 원본 응답:",
    upstageData.answer,
  );

  const aiResult =
    parseEssayAiResult(
      upstageData.answer,
    );

  if (
    aiResult.bridges.length !==
    items.length
  ) {
    throw new Error(
      `AI 연결 문장 개수가 기록 개수와 다릅니다. 기록: ${items.length}, 연결 문장: ${aiResult.bridges.length}`,
    );
  }

  const {
    data: savedEssayId,
    error: saveError,
  } = await supabase.rpc(
    "save_essay_ai_result",
    {
      p_essay_id: essayId,
      p_title: aiResult.title,
      p_bridges: aiResult.bridges,
    },
  );

  throwIfError(
    "AI 에세이 결과 저장 실패",
    saveError,
  );

  if (!savedEssayId) {
    throw new Error(
      "save_essay_ai_result RPC가 에세이 ID를 반환하지 않았습니다.",
    );
  }

  const {
    data: savedEssay,
    error: verifyError,
  } = await supabase
    .from("essays")
    .select(`
      id,
      title,
      status,
      essay_items (
        id,
        sort_order,
        ai_bridge_text
      )
    `)
    .eq("id", savedEssayId)
    .single();

  throwIfError(
    "저장된 AI 에세이 확인 실패",
    verifyError,
  );

  const savedItems = [
    ...(savedEssay.essay_items ?? []),
  ].sort(
    (a, b) =>
      a.sort_order - b.sort_order,
  );

  if (
    savedItems.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `저장된 essay_items 수가 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${savedItems.length}개`,
    );
  }

  if (
    savedItems.some(
      (item) =>
        !item.ai_bridge_text,
    )
  ) {
    throw new Error(
      "저장되지 않은 AI 연결 문장이 있습니다.",
    );
  }

  console.log(
    `✅ AI 에세이 제목 저장 성공: ${savedEssay.title}`,
  );

  console.log(
    `✅ AI 연결 문장 저장 성공: ${savedItems.length}개`,
  );

  return {
    ...savedEssay,
    essay_items: savedItems,
  };
}
async function main() {
  console.log(
    "\n🚀 1주·기록 4개 백엔드 통합 테스트 시작\n",
  );

  const {
    data: loginData,
    error: loginError,
  } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  throwIfError(
    "테스트 계정 로그인 실패",
    loginError,
  );

  const user = loginData.user;

  if (!user) {
    throw new Error(
      "로그인했지만 사용자 정보가 없습니다.",
    );
  }

  console.log(
    `✅ 로그인 성공: ${user.email}`,
  );

  await ensureProfile(user);

  const journey =
    await getOrCreateTestJourney(user);

  await buildFourRecordJourney(
    user,
    journey,
  );

  const finalResult =
    await verifyFinalResults(
      user,
      journey.id,
    );

  const essayResult =
    await createEssayDraftAndVerify(
      user,
      journey.id,
    );

  console.log(
    "에세이:",
    essayResult.essay,
  );

  console.log(
    "에세이 기록:",
    essayResult.essayItems,
  );

  const aiEssay =
    await generateEssayWithUpstageAndVerify(
      essayResult.essay.id,
    );

  console.log(
    "AI 에세이 결과:",
    aiEssay,
  );

  console.log(
    "\n==============================",
  );

  console.log(
    "🎉 1주 Journey 에세이 통합 테스트 최종 성공",
  );

  console.log(
    "==============================",
  );

  console.log(
    `Journey 기록 수: ${finalResult.records.length}`,
  );

  console.log(
    `에세이 연결 기록 수: ${essayResult.essayItems.length}`,
  );

  console.log(
    `AI 연결 문장 수: ${aiEssay.essay_items.length}`,
  );

  await supabase.auth.signOut({
    scope: "local",
  });
}

main().catch(async (error) => {
  console.error(
    "\n==============================",
  );

  console.error(
    "❌ 1주·기록 4개 백엔드 통합 테스트 실패",
  );

  console.error(
    "==============================",
  );

  console.error(error);

  try {
    await supabase.auth.signOut({
      scope: "local",
    });
  } catch {
    // 로그아웃 오류는 무시
  }

  process.exitCode = 1;
});
