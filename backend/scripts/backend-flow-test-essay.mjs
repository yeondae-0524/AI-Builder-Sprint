import {
    TEST_ESSAY_TITLE,
    TEST_LABEL,
    TEST_TARGET_RECORD_COUNT,
    supabase,
    throwIfError,
} from "./backend-flow-test-config.mjs";

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
    `🎉 ${TEST_LABEL} 백엔드 통합 테스트 성공`,
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
        p_title: TEST_ESSAY_TITLE,
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

export {
    createEssayDraftAndVerify,
    verifyFinalResults
};
