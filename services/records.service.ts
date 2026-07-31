import { supabase } from "@/lib/supabase";

export type RecordVisibility =
  | "private"
  | "anonymous"
  | "nickname";

export interface CreateRecordDTO {
  missionAttemptId: string;
  emotion: string;
  content: string;
  visibility?: RecordVisibility;
  placeId?: string | null;
}

/**
 * 기록 생성과 함께 다음 작업을 처리한다.
 *
 * - records 생성
 * - mission_attempts 완료 처리
 * - Journey 목표 달성 시 completed 처리
 */
export async function createRecord({
  missionAttemptId,
  emotion,
  content,
  visibility = "private",
  placeId = null,
}: CreateRecordDTO) {
  try {
    if (!missionAttemptId) {
      throw new Error("missionAttemptId가 필요합니다.");
    }

    if (!emotion.trim()) {
      throw new Error("감정을 선택해야 합니다.");
    }

    if (!content.trim()) {
      throw new Error("기록 내용을 입력해야 합니다.");
    }

    const { data: recordId, error } = await supabase.rpc(
      "complete_mission_with_record",
      {
        p_mission_attempt_id: missionAttemptId,
        p_emotion: emotion.trim(),
        p_content: content.trim(),
        p_visibility: visibility,
        p_place_id: placeId,
      },
    );

    if (error) {
      throw error;
    }

    return {
      success: true as const,
      recordId: recordId as string,
    };
  } catch (error) {
    console.error("createRecord Error:", error);

    return {
      success: false as const,
      error,
    };
  }
}

/**
 * 현재 로그인한 사용자의 기록을 최신순으로 조회한다.
 */
export async function getMyRecords() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data, error } = await supabase
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
      updated_at,
      record_photos (
        id,
        storage_path,
        sort_order,
        is_cover
      ),
      mission_attempts (
        id,
        status,
        missions (
          id,
          title,
          short_description
        )
      ),
      places (
        id,
        name,
        category_name,
        address,
        road_address
      )
    `)
    .eq("user_id", user.id)
    .order("recorded_at", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("getMyRecords Error:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * 특정 연도와 월에 작성한 내 기록을 조회한다.
 *
 * month는 1부터 12까지 입력한다.
 * 예: getRecordsByMonth(2026, 7)
 */
export async function getRecordsByMonth(
  year: number,
  month: number,
) {
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error("올바른 연도를 입력해야 합니다.");
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("월은 1부터 12까지 입력해야 합니다.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const startMonth = String(month).padStart(2, "0");
  const startDate = `${year}-${startMonth}-01`;

  const nextMonthDate = new Date(
    Date.UTC(year, month, 1),
  );

  const endDate = nextMonthDate
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("records")
    .select(`
      id,
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
      ),
      mission_attempts (
        id,
        missions (
          id,
          title
        )
      ),
      places (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .gte("recorded_at", startDate)
    .lt("recorded_at", endDate)
    .order("recorded_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "getRecordsByMonth Error:",
      error,
    );

    throw error;
  }

  return data ?? [];
}

/**
 * 특정 기록의 상세 정보를 조회한다.
 */
export async function getRecordById(
  recordId: string,
) {
  if (!recordId.trim()) {
    throw new Error("recordId가 필요합니다.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data, error } = await supabase
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
      updated_at,
      record_photos (
        id,
        storage_path,
        sort_order,
        is_cover,
        created_at
      ),
      mission_attempts (
        id,
        status,
        selected_at,
        started_at,
        completed_at,
        missions (
          id,
          title,
          short_description,
          instructions
        )
      ),
      places (
        id,
        name,
        category_name,
        address,
        road_address,
        latitude,
        longitude
      ),
      journeys (
        id,
        title,
        status,
        start_date,
        end_date
      )
    `)
    .eq("id", recordId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getRecordById Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      "기록을 찾을 수 없거나 접근 권한이 없습니다.",
    );
  }

  return data;
}

/**
 * 특정 Journey에서 작성한 내 기록을 조회한다.
 */
export async function getRecordsByJourney(
  journeyId: string,
) {
  if (!journeyId.trim()) {
    throw new Error("journeyId가 필요합니다.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("records")
    .select(`
      id,
      journey_id,
      mission_attempt_id,
      place_id,
      emotion,
      content,
      visibility,
      recorded_at,
      created_at,
      updated_at,
      record_photos (
        id,
        storage_path,
        sort_order,
        is_cover
      ),
      mission_attempts (
        id,
        status,
        missions (
          id,
          title,
          short_description
        )
      ),
      places (
        id,
        name,
        category_name
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

  if (error) {
    console.error(
      "getRecordsByJourney Error:",
      error,
    );
    throw error;
  }

  return data ?? [];
}

export type UpdateRecordInput = {
  emotion?: "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
  content?: string;
  visibility?: "private" | "anonymous" | "nickname";
  placeId?: string | null;
};

/**
 * 본인의 기록을 수정한다.
 */
export async function updateRecord(
  recordId: string,
  input: UpdateRecordInput,
) {
  if (!recordId.trim()) {
    throw new Error("recordId가 필요합니다.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  if (
    input.content !== undefined &&
    !input.content.trim()
  ) {
    throw new Error("기록 내용은 비워둘 수 없습니다.");
  }

  const updateData: {
    emotion?: UpdateRecordInput["emotion"];
    content?: string;
    visibility?: UpdateRecordInput["visibility"];
    place_id?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (input.emotion !== undefined) {
    updateData.emotion = input.emotion;
  }

  if (input.content !== undefined) {
    updateData.content = input.content.trim();
  }

  if (input.visibility !== undefined) {
    updateData.visibility = input.visibility;
  }

  if (input.placeId !== undefined) {
    updateData.place_id = input.placeId;
  }

  const { data, error } = await supabase
    .from("records")
    .update(updateData)
    .eq("id", recordId)
    .eq("user_id", user.id)
    .select(`
      id,
      journey_id,
      mission_attempt_id,
      place_id,
      emotion,
      content,
      visibility,
      recorded_at,
      created_at,
      updated_at
    `)
    .maybeSingle();

  if (error) {
    console.error("updateRecord Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      "기록을 찾을 수 없거나 수정 권한이 없습니다.",
    );
  }

  return data;
}

/**
 * 기록에 연결된 Storage 사진과 기록을 삭제한다.
 */
export async function deleteRecord(
  recordId: string,
) {
  if (!recordId.trim()) {
    throw new Error("recordId가 필요합니다.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  // 삭제 전에 본인 기록인지 확인하고 사진 경로 조회
  const { data: record, error: recordError } =
    await supabase
      .from("records")
      .select(`
        id,
        record_photos (
          storage_path
        )
      `)
      .eq("id", recordId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (recordError) {
    console.error(
      "deleteRecord 조회 Error:",
      recordError,
    );
    throw recordError;
  }

  if (!record) {
    throw new Error(
      "기록을 찾을 수 없거나 삭제 권한이 없습니다.",
    );
  }

  const storagePaths = (
    record.record_photos ?? []
  )
    .map((photo) => photo.storage_path)
    .filter(
      (path): path is string =>
        typeof path === "string" &&
        path.length > 0,
    );

  // Storage 정책상 records 행이 존재할 때 사진부터 삭제해야 함
  if (storagePaths.length > 0) {
    const { error: storageError } =
      await supabase.storage
        .from("record-photos")
        .remove(storagePaths);

    if (storageError) {
      console.error(
        "deleteRecord Storage Error:",
        storageError,
      );
      throw storageError;
    }
  }

  // 기록 삭제 시 record_photos, likes, saves,
  // essay_items는 CASCADE로 함께 삭제됨
  const { error: deleteError } = await supabase
    .from("records")
    .delete()
    .eq("id", recordId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error(
      "deleteRecord Error:",
      deleteError,
    );
    throw deleteError;
  }

  return {
    success: true as const,
    deletedRecordId: recordId,
  };
}