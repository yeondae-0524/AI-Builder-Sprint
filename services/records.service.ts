import { supabase } from "@/lib/supabase";
import { getRecordPhotoUrls } from "./storage.service";

export type RecordVisibility =
  | "private"
  | "anonymous"
  | "nickname";

export type RecordEmotion =
  | "comfortable"
  | "joyful"
  | "new"
  | "uncomfortable"
  | "unsure";

export interface CreateRecordDTO {
  missionAttemptId: string;
  emotion: RecordEmotion;
  content: string;
  visibility?: RecordVisibility;
  placeId?: string | null;
}

export type UpdateRecordInput = {
  emotion?: RecordEmotion;
  content?: string;
  visibility?: RecordVisibility;
  placeId?: string | null;
};

type RecordPhotoRow = {
  id: string;
  storage_path: string;
  sort_order: number;
  is_cover: boolean;
  created_at?: string;
};

export type RecordPhotoWithUrl = RecordPhotoRow & {
  signed_url: string | null;
};

const ALLOWED_EMOTIONS: RecordEmotion[] = [
  "comfortable",
  "joyful",
  "new",
  "uncomfortable",
  "unsure",
];

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user.id;
}

function requireId(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label}가 필요합니다.`);
  }
}

function validateEmotion(
  emotion: string,
): asserts emotion is RecordEmotion {
  if (
    !ALLOWED_EMOTIONS.includes(
      emotion as RecordEmotion,
    )
  ) {
    throw new Error("허용되지 않은 감정 코드입니다.");
  }
}

function getPhotoRows(
  value: unknown,
): RecordPhotoRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (photo): photo is RecordPhotoRow =>
      typeof photo === "object" &&
      photo !== null &&
      "id" in photo &&
      "storage_path" in photo &&
      typeof photo.storage_path === "string",
  );
}

/**
 * record_photos.storage_path를 private Storage Signed URL로 변환한다.
 *
 * Signed URL 생성에 실패하더라도 기록 조회 자체는 유지하고
 * 각 사진의 signed_url을 null로 반환한다.
 */
async function attachSignedPhotoUrls<
  T extends {
    record_photos?: unknown;
  },
>(
  records: T[],
): Promise<
  Array<
    Omit<T, "record_photos"> & {
      record_photos: RecordPhotoWithUrl[];
    }
  >
> {
  const paths = Array.from(
    new Set(
      records.flatMap((record) =>
        getPhotoRows(record.record_photos)
          .map((photo) => photo.storage_path)
          .filter((path) => path.trim().length > 0),
      ),
    ),
  );

  const signedUrlByPath = new Map<
    string,
    string
  >();

  if (paths.length > 0) {
    try {
      const signedItems =
        await getRecordPhotoUrls(paths);

      signedItems.forEach((item) => {
        if (
          item.storagePath &&
          item.signedUrl
        ) {
          signedUrlByPath.set(
            item.storagePath,
            item.signedUrl,
          );
        }
      });
    } catch (error) {
      console.error(
        "기록 사진 Signed URL 생성 실패:",
        error,
      );
    }
  }

  return records.map((record) => {
    const photos = getPhotoRows(
      record.record_photos,
    )
      .map((photo) => ({
        ...photo,
        signed_url:
          signedUrlByPath.get(
            photo.storage_path,
          ) ?? null,
      }))
      .sort((a, b) => {
        if (a.is_cover !== b.is_cover) {
          return a.is_cover ? -1 : 1;
        }

        return a.sort_order - b.sort_order;
      });

    const {
      record_photos: _recordPhotos,
      ...rest
    } = record;

    return {
      ...rest,
      record_photos: photos,
    };
  });
}

/**
 * 기록 생성과 함께 다음 작업을 처리한다.
 *
 * - records 생성
 * - mission_attempts 완료 처리
 * - 배지 포인트 증가
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
    requireId(
      missionAttemptId,
      "missionAttemptId",
    );

    validateEmotion(emotion);

    if (!content.trim()) {
      throw new Error(
        "기록 내용을 입력해야 합니다.",
      );
    }

    const { data: recordId, error } =
      await supabase.rpc(
        "complete_mission_with_record",
        {
          p_mission_attempt_id:
            missionAttemptId,
          p_emotion: emotion,
          p_content: content.trim(),
          p_visibility: visibility,
          p_place_id: placeId,
        },
      );

    if (error) {
      throw error;
    }

    if (!recordId) {
      throw new Error(
        "생성된 기록 ID를 확인하지 못했습니다.",
      );
    }

    return {
      success: true as const,
      recordId: String(recordId),
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
 *
 * record_photos에는 storage_path와 signed_url이 함께 반환된다.
 */
export async function getMyRecords() {
  const userId = await getCurrentUserId();

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
    .eq("user_id", userId)
    .order("recorded_at", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "getMyRecords Error:",
      error,
    );
    throw error;
  }

  return attachSignedPhotoUrls(data ?? []);
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
    throw new Error(
      "올바른 연도를 입력해야 합니다.",
    );
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "월은 1부터 12까지 입력해야 합니다.",
    );
  }

  const userId = await getCurrentUserId();

  const startMonth = String(month).padStart(
    2,
    "0",
  );
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
    .eq("user_id", userId)
    .gte("recorded_at", startDate)
    .lt("recorded_at", endDate)
    .order("recorded_at", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "getRecordsByMonth Error:",
      error,
    );
    throw error;
  }

  return attachSignedPhotoUrls(data ?? []);
}

/**
 * 특정 기록의 상세 정보를 조회한다.
 */
export async function getRecordById(
  recordId: string,
) {
  requireId(recordId, "recordId");

  const userId = await getCurrentUserId();

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
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "getRecordById Error:",
      error,
    );
    throw error;
  }

  if (!data) {
    throw new Error(
      "기록을 찾을 수 없거나 접근 권한이 없습니다.",
    );
  }

  const [recordWithPhotoUrls] =
    await attachSignedPhotoUrls([data]);

  return recordWithPhotoUrls;
}

/**
 * 특정 Journey에서 작성한 내 기록을 조회한다.
 */
export async function getRecordsByJourney(
  journeyId: string,
) {
  requireId(journeyId, "journeyId");

  const userId = await getCurrentUserId();

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
    .eq("user_id", userId)
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

  return attachSignedPhotoUrls(data ?? []);
}

/**
 * 본인의 기록을 수정한다.
 */
export async function updateRecord(
  recordId: string,
  input: UpdateRecordInput,
) {
  requireId(recordId, "recordId");

  const userId = await getCurrentUserId();

  if (
    input.content !== undefined &&
    !input.content.trim()
  ) {
    throw new Error(
      "기록 내용은 비워둘 수 없습니다.",
    );
  }

  if (input.emotion !== undefined) {
    validateEmotion(input.emotion);
  }

  const updateData: {
    emotion?: RecordEmotion;
    content?: string;
    visibility?: RecordVisibility;
    place_id?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (input.emotion !== undefined) {
    updateData.emotion = input.emotion;
  }

  if (input.content !== undefined) {
    updateData.content =
      input.content.trim();
  }

  if (input.visibility !== undefined) {
    updateData.visibility =
      input.visibility;
  }

  if (input.placeId !== undefined) {
    updateData.place_id = input.placeId;
  }

  const { data, error } = await supabase
    .from("records")
    .update(updateData)
    .eq("id", recordId)
    .eq("user_id", userId)
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
    console.error(
      "updateRecord Error:",
      error,
    );
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
  requireId(recordId, "recordId");

  const userId = await getCurrentUserId();

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
      .eq("user_id", userId)
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
        path.trim().length > 0,
    );

  // Storage 정책상 records 행이 존재할 때 사진부터 삭제해야 한다.
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

  // records 삭제 시 연결 데이터는 DB의 FK 설정에 따라 함께 삭제된다.
  const { error: deleteError } =
    await supabase
      .from("records")
      .delete()
      .eq("id", recordId)
      .eq("user_id", userId);

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