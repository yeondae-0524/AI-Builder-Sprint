import {
  TEST_TARGET_RECORD_COUNT,
  supabase,
  throwIfError,
} from "./backend-flow-test-config.mjs";

const TEST_ESSAY_TITLE =
  "백엔드 통합 테스트 에세이";

function toArray(value) {
  if (!value) return [];

  return Array.isArray(value)
    ? value
    : [value];
}

function sortEssayItems(items) {
  return [...(items ?? [])].sort(
    (a, b) =>
      Number(a.sort_order ?? 0) -
      Number(b.sort_order ?? 0),
  );
}

async function getJourneyRecords(
  user,
  journeyId,
) {
  const {
    data,
    error,
  } = await supabase
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
      recorded_at,
      created_at,
      record_photos (
        id,
        storage_path,
        sort_order,
        is_cover
      )
    `)
    .eq("user_id", user.id)
    .eq("journey_id", journeyId)
    .order("recorded_at", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  throwIfError(
    "Journey 기록 조회 실패",
    error,
  );

  return data ?? [];
}

export async function verifyFinalResults(
  user,
  journeyId,
) {
  const {
    data: journey,
    error: journeyError,
  } = await supabase
    .from("journeys")
    .select(`
      id,
      user_id,
      title,
      status,
      duration_days,
      target_record_count,
      start_date,
      end_date
    `)
    .eq("id", journeyId)
    .eq("user_id", user.id)
    .single();

  throwIfError(
    "최종 Journey 검증 실패",
    journeyError,
  );

  const records =
    await getJourneyRecords(
      user,
      journeyId,
    );

  if (
    journey.status !== "completed"
  ) {
    throw new Error(
      `Journey 상태가 completed가 아닙니다: ${journey.status}`,
    );
  }

  if (
    Number(
      journey.target_record_count,
    ) !== TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `Journey 목표 기록 수가 잘못됐습니다. 예상: ${TEST_TARGET_RECORD_COUNT}, 실제: ${journey.target_record_count}`,
    );
  }

  if (
    records.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `Journey 기록 수가 잘못됐습니다. 예상: ${TEST_TARGET_RECORD_COUNT}, 실제: ${records.length}`,
    );
  }

  const invalidRecord =
    records.find(
      (record) =>
        record.user_id !== user.id ||
        record.journey_id !==
          journeyId ||
        !String(
          record.content ?? "",
        ).trim() ||
        !String(
          record.emotion ?? "",
        ).trim() ||
        !record.mission_attempt_id,
    );

  if (invalidRecord) {
    throw new Error(
      `유효하지 않은 기록이 있습니다: ${invalidRecord.id}`,
    );
  }

  const attemptIds =
    Array.from(
      new Set(
        records.map(
          (record) =>
            String(
              record.mission_attempt_id,
            ),
        ),
      ),
    );

  if (
    attemptIds.length !==
    records.length
  ) {
    throw new Error(
      "기록의 mission_attempt_id가 비어 있거나 중복됐습니다.",
    );
  }

  const {
    data: attempts,
    error: attemptsError,
  } = await supabase
    .from("mission_attempts")
    .select(`
      id,
      user_id,
      journey_id,
      status,
      completed_at
    `)
    .in("id", attemptIds);

  throwIfError(
    "최종 미션 시도 검증 실패",
    attemptsError,
  );

  if (
    (attempts?.length ?? 0) !==
    records.length
  ) {
    throw new Error(
      "기록과 연결된 미션 시도를 모두 조회하지 못했습니다.",
    );
  }

  const invalidAttempt =
    (attempts ?? []).find(
      (attempt) =>
        attempt.user_id !== user.id ||
        attempt.journey_id !==
          journeyId ||
        attempt.status !==
          "completed" ||
        !attempt.completed_at,
    );

  if (invalidAttempt) {
    throw new Error(
      `완료되지 않은 미션 시도가 있습니다: ${invalidAttempt.id}`,
    );
  }

  const photos =
    records.flatMap(
      (record) =>
        toArray(
          record.record_photos,
        ),
    );

  console.log(
    `✅ Journey 완료 확인: ${journey.title}`,
  );

  console.log(
    `✅ Journey 기록 확인: ${records.length}개`,
  );

  console.log(
    `✅ 완료된 미션 시도 확인: ${attempts.length}개`,
  );

  console.log(
    `✅ 기록 사진 확인: ${photos.length}개`,
  );

  return {
    journey,
    records,
    attempts: attempts ?? [],
    photos,
  };
}

async function removeOldTestEssays(
  user,
  journeyId,
) {
  const {
    data: oldEssays,
    error: selectError,
  } = await supabase
    .from("essays")
    .select("id")
    .eq("user_id", user.id)
    .eq("journey_id", journeyId);

  throwIfError(
    "기존 Journey 에세이 조회 실패",
    selectError,
  );

  const essayIds =
    (oldEssays ?? []).map(
      (essay) =>
        String(essay.id),
    );

  if (
    essayIds.length === 0
  ) {
    return;
  }

  /*
   * 외래키 설정에 ON DELETE CASCADE가 없어도
   * 삭제될 수 있도록 자식 데이터부터 정리한다.
   */

  const {
    error: versionDeleteError,
  } = await supabase
    .from("essay_versions")
    .delete()
    .in(
      "essay_id",
      essayIds,
    );

  throwIfError(
    "기존 에세이 버전 삭제 실패",
    versionDeleteError,
  );

  const {
    error: itemDeleteError,
  } = await supabase
    .from("essay_items")
    .delete()
    .in(
      "essay_id",
      essayIds,
    );

  throwIfError(
    "기존 에세이 기록 연결 삭제 실패",
    itemDeleteError,
  );

  const {
    error: essayDeleteError,
  } = await supabase
    .from("essays")
    .delete()
    .in(
      "id",
      essayIds,
    )
    .eq(
      "user_id",
      user.id,
    );

  throwIfError(
    "기존 Journey 에세이 삭제 실패",
    essayDeleteError,
  );

  console.log(
    `🧹 기존 Journey 에세이 ${essayIds.length}개 정리 완료`,
  );
}

function getCoverPhotoPath(
  record,
) {
  const photos = [
    ...toArray(
      record?.record_photos,
    ),
  ].sort((a, b) => {
    if (
      Boolean(a.is_cover) !==
      Boolean(b.is_cover)
    ) {
      return a.is_cover
        ? -1
        : 1;
    }

    return (
      Number(
        a.sort_order ?? 0,
      ) -
      Number(
        b.sort_order ?? 0,
      )
    );
  });

  return (
    photos[0]?.storage_path ??
    null
  );
}

export async function createEssayDraftAndVerify(
  user,
  journeyId,
) {
  const {
    data: journey,
    error: journeyError,
  } = await supabase
    .from("journeys")
    .select(`
      id,
      user_id,
      title,
      status,
      target_record_count
    `)
    .eq("id", journeyId)
    .eq("user_id", user.id)
    .single();

  throwIfError(
    "에세이 생성 대상 Journey 조회 실패",
    journeyError,
  );

  if (
    journey.status !== "completed"
  ) {
    throw new Error(
      `완료된 Journey만 에세이를 만들 수 있습니다: ${journey.status}`,
    );
  }

  const records =
    await getJourneyRecords(
      user,
      journeyId,
    );

  if (
    records.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `에세이에 연결할 기록 수가 잘못됐습니다. 예상: ${TEST_TARGET_RECORD_COUNT}, 실제: ${records.length}`,
    );
  }

  /*
   * 테스트를 반복 실행해도
   * 항상 version_no 1부터 검사할 수 있도록
   * 같은 Journey의 이전 테스트용 에세이만 삭제한다.
   */
  await removeOldTestEssays(
    user,
    journeyId,
  );

  const {
    data: essay,
    error: essayError,
  } = await supabase
    .from("essays")
    .insert({
      user_id: user.id,
      journey_id: journeyId,

      title:
        TEST_ESSAY_TITLE,

      content: "",

      essay_type:
        "taste_report",

      postcard_format: null,

      selected_payload: {},

      selected_version_no:
        null,

      generation_count: 0,

      generation_state:
        "idle",

      generation_started_at:
        null,

      cover_photo_path:
        getCoverPhotoPath(
          records[0],
        ),

      visibility: "private",

      status: "draft",

      published_at: null,
    })
    .select(`
      id,
      user_id,
      journey_id,
      title,
      content,
      essay_type,
      postcard_format,
      selected_version_no,
      generation_count,
      generation_state,
      generation_started_at,
      cover_photo_path,
      visibility,
      status,
      published_at,
      created_at,
      updated_at
    `)
    .single();

  throwIfError(
    "에세이 초안 생성 실패",
    essayError,
  );

  try {
    const {
      data: items,
      error: itemError,
    } = await supabase
      .from("essay_items")
      .insert(
        records.map(
          (
            record,
            index,
          ) => ({
            essay_id:
              essay.id,

            record_id:
              record.id,

            sort_order:
              index,

            /*
             * 기존 컬럼이 NOT NULL일 수 있으므로
             * 빈 문자열만 넣는다.
             * 새 테스트에서는 이 값을
             * AI 결과로 사용하지 않는다.
             */
            ai_bridge_text:
              "",
          }),
        ),
      )
      .select(`
        id,
        essay_id,
        record_id,
        sort_order,
        created_at
      `);

    throwIfError(
      "에세이 기록 연결 생성 실패",
      itemError,
    );

    const essayItems =
      sortEssayItems(items);

    if (
      essay.status !== "draft"
    ) {
      throw new Error(
        `에세이 상태가 draft가 아닙니다: ${essay.status}`,
      );
    }

    if (
      essay.visibility !==
      "private"
    ) {
      throw new Error(
        `에세이 공개 범위가 private이 아닙니다: ${essay.visibility}`,
      );
    }

    if (
      essay.selected_version_no !==
      null
    ) {
      throw new Error(
        `selected_version_no가 null이 아닙니다: ${essay.selected_version_no}`,
      );
    }

    if (
      Number(
        essay.generation_count,
      ) !== 0
    ) {
      throw new Error(
        `generation_count가 0이 아닙니다: ${essay.generation_count}`,
      );
    }

    if (
      essay.generation_state !==
      "idle"
    ) {
      throw new Error(
        `generation_state가 idle이 아닙니다: ${essay.generation_state}`,
      );
    }

    if (
      essayItems.length !==
      TEST_TARGET_RECORD_COUNT
    ) {
      throw new Error(
        `essay_items 수가 잘못됐습니다. 예상: ${TEST_TARGET_RECORD_COUNT}, 실제: ${essayItems.length}`,
      );
    }

    essayItems.forEach(
      (item, index) => {
        if (
          Number(
            item.sort_order,
          ) !== index
        ) {
          throw new Error(
            `${index + 1}번째 essay_item의 sort_order가 잘못됐습니다: ${item.sort_order}`,
          );
        }

        if (
          String(
            item.record_id,
          ) !==
          String(
            records[index].id,
          )
        ) {
          throw new Error(
            `${index + 1}번째 essay_item의 record_id가 잘못됐습니다.`,
          );
        }
      },
    );

    console.log(
      `✅ 에세이 초안 생성 성공: ${essay.id}`,
    );

    console.log(
      `✅ 에세이 기록 연결 성공: ${essayItems.length}개`,
    );

    console.log(
      "✅ 초기 상태 확인: generation_count=0, generation_state=idle",
    );

    return {
      essay,
      essayItems,
    };
  } catch (error) {
    /*
     * essay_items 생성 또는 검증에 실패하면
     * 불완전한 테스트 에세이를 정리한다.
     */
    await supabase
      .from("essays")
      .delete()
      .eq("id", essay.id)
      .eq(
        "user_id",
        user.id,
      );

    throw error;
  }
}