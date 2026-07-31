import {
    TEST_RECORDS,
    TEST_TARGET_RECORD_COUNT,
    supabase,
    throwIfError,
} from "./backend-flow-test-config.mjs";

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

async function getActiveAttempt(userId) {
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
    .eq("user_id", userId)
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

async function removeStaleTestAttempt(
  user,
  attempt,
) {
  const {
    data: attemptJourney,
    error: journeyError,
  } = await supabase
    .from("journeys")
    .select("id, title, status")
    .eq("id", attempt.journey_id)
    .eq("user_id", user.id)
    .maybeSingle();

  throwIfError(
    "기존 진행 중 미션의 Journey 조회 실패",
    journeyError,
  );

  const isTestJourney =
    attemptJourney?.title?.startsWith(
      "백엔드 통합 테스트",
    );

  if (!isTestJourney) {
    throw new Error(
      [
        "테스트 Journey와 다른 실제 Journey에 진행 중인 미션이 있습니다.",
        `mission_attempt_id: ${attempt.id}`,
        `journey_id: ${attempt.journey_id}`,
        "실제 사용자 데이터를 자동 삭제하지 않으므로 앱에서 먼저 미션을 완료하거나 취소해주세요.",
      ].join("\n"),
    );
  }

  const {
    data: deletedAttempts,
    error: deleteError,
  } = await supabase
    .from("mission_attempts")
    .delete()
    .eq("id", attempt.id)
    .eq("user_id", user.id)
    .in("status", ["selected", "started"])
    .select("id");

  throwIfError(
    "이전 테스트의 진행 중 미션 정리 실패",
    deleteError,
  );

  if (!deletedAttempts?.length) {
    throw new Error(
      [
        "이전 테스트의 진행 중 미션을 삭제하지 못했습니다.",
        "mission_attempts DELETE RLS 정책 또는 취소 RPC를 확인해주세요.",
        `mission_attempt_id: ${attempt.id}`,
      ].join("\n"),
    );
  }

  console.log(
    `🧹 이전 테스트의 진행 중 미션 정리: ${attempt.id}`,
  );
}

async function createMissionAttempt(
  user,
  journey,
) {
  let existingAttempt =
    await getActiveAttempt(user.id);

  if (
    existingAttempt &&
    existingAttempt.journey_id !== journey.id
  ) {
    await removeStaleTestAttempt(
      user,
      existingAttempt,
    );

    existingAttempt = null;
  }

  if (existingAttempt) {
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

async function buildRecordJourney(
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
      `✅ Journey가 이미 기록 ${TEST_TARGET_RECORD_COUNT}개로 완료되어 생성 단계를 건너뜁니다.`,
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

export {
    buildRecordJourney
};
