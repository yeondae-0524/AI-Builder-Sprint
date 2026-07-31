import { supabase } from "../lib/supabase";

export type EssayStyle = "plain" | "balanced" | "emotional";
export type EssayVisibility = "private" | "public";
export type EssayGenerationState = "idle" | "generating" | "error";

export type EssayVersion = {
  id: string;
  versionNo: 1 | 2;
  style: EssayStyle;
  title: string;
  content: string;
  createdAt: string;
};

export type EssayRecord = {
  id: string;
  missionTitle: string;
  missionDescription: string;
  recordedAt: string;
  content: string;
  emotion: string | null;
  placeName: string | null;
  photoUrls: string[];
};

export type EssaySummary = {
  id: string;
  journeyId: string;
  journeyTitle: string;
  durationDays: number;
  startDate: string;
  endDate: string | null;
  title: string;
  content: string;
  status: string;
  visibility: EssayVisibility;
  selectedVersionNo: 1 | 2 | null;
  generationCount: number;
  generationState: EssayGenerationState;
  generationStartedAt: string | null;
  publishedAt: string | null;
  coverPhotoUrl: string | null;
  coverPhotoPath: string | null;
  sourceRecordCount: number;
  versionCount: number;
  updatedAt: string;
};

export type JourneyEssayCandidate = {
  id: string;
  title: string;
  durationDays: number;
  targetDayCount: number;
  completedDayCount: number;
  startDate: string;
  endDate: string | null;
  status: "active" | "completed";
  canCreateEssay: boolean;
};

export type EssayDashboardData = {
  nickname: string;
  essays: EssaySummary[];
  journey: JourneyEssayCandidate | null;
};

export type EssayDetail = EssaySummary & {
  nickname: string;
  isOwner: boolean;
  versions: EssayVersion[];
  records: EssayRecord[];
};

type RawEssay = {
  id: string;
  user_id: string;
  journey_id: string;
  title: string | null;
  content: string | null;
  status: string | null;
  visibility: string | null;
  selected_version_no: number | null;
  generation_count: number | null;
  generation_state: string | null;
  generation_started_at: string | null;
  published_at: string | null;
  cover_photo_path: string | null;
  created_at: string;
  updated_at: string;
};

type RawJourney = {
  id: string;
  user_id: string;
  title: string | null;
  duration_days: number | null;
  target_record_count: number | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | string;
  created_at: string;
};

type RawRecord = {
  id: string;
  journey_id: string;
  mission_attempt_id: string | null;
  place_id: string | null;
  recorded_at: string;
  emotion: string | null;
  content: string | null;
};

const STYLE_LABELS: Record<EssayStyle, string> = {
  plain: "더 담백하게",
  balanced: "기본 균형",
  emotional: "조금 더 감성적으로",
};

const EMOTION_LABELS: Record<string, string> = {
  comfortable: "편안함",
  joyful: "즐거움",
  new: "새로움",
  uncomfortable: "불편함",
  unsure: "잘 모르겠음",
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();

    if (message) return message;
  }

  return fallback;
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getCompletedDayCount(records: RawRecord[]) {
  return new Set(
    records
      .map((record) => normalizeDateKey(record.recorded_at))
      .filter(Boolean),
  ).size;
}

function normalizeVisibility(value: string | null): EssayVisibility {
  return value === "public" ? "public" : "private";
}

function normalizeGenerationState(
  value: string | null,
): EssayGenerationState {
  if (value === "generating" || value === "error") return value;
  return "idle";
}

function normalizeVersionNo(value: number | null): 1 | 2 | null {
  return value === 1 || value === 2 ? value : null;
}

function deterministicNumber(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

export function getStableBookHeight(essayId: string) {
  return 150 + (deterministicNumber(essayId) % 29);
}

export function getBookWidthByDuration(durationDays: number) {
  if (durationDays <= 7) return 28;
  if (durationDays <= 14) return 44;
  return 62;
}

async function getRequiredUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("로그인이 필요합니다.");

  return user;
}

async function createSignedUrlMap(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const result = new Map<string, string>();
  const storagePaths: string[] = [];

  for (const path of uniquePaths) {
    if (/^https?:\/\//i.test(path)) {
      result.set(path, path);
    } else {
      storagePaths.push(path);
    }
  }

  if (storagePaths.length === 0) return result;

  const { data, error } = await supabase.storage
    .from("record-photos")
    .createSignedUrls(storagePaths, 60 * 60);

  if (error) {
    console.warn("에세이 사진 URL 생성 실패:", error);
    return result;
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}

async function resetStaleGenerationRows(userId: string) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("essays")
    .update({
      generation_state: "error",
      generation_started_at: null,
    })
    .eq("user_id", userId)
    .eq("generation_state", "generating")
    .lt("generation_started_at", cutoff);

  if (error) {
    console.warn("멈춘 에세이 생성 상태 정리 실패:", error);
  }
}

async function fetchNickname(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("에세이 작성자 닉네임 조회 실패:", error);
  }

  return String(data?.nickname ?? "나");
}

async function fetchJourneysByIds(ids: string[]) {
  const map = new Map<string, RawJourney>();

  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("journeys")
    .select(
      "id, user_id, title, duration_days, target_record_count, start_date, end_date, status, created_at",
    )
    .in("id", ids);

  if (error) throw error;

  for (const row of (data ?? []) as RawJourney[]) {
    map.set(String(row.id), row);
  }

  return map;
}

async function fetchEssayVersions(essayIds: string[]) {
  const map = new Map<string, EssayVersion[]>();

  if (essayIds.length === 0) return map;

  const { data, error } = await supabase
    .from("essay_versions")
    .select("id, essay_id, version_no, style, title, content, created_at")
    .in("essay_id", essayIds)
    .order("version_no", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const essayId = String(row.essay_id);
    const current = map.get(essayId) ?? [];
    current.push({
      id: String(row.id),
      versionNo: Number(row.version_no) as 1 | 2,
      style: row.style as EssayStyle,
      title: String(row.title ?? "나의 에세이"),
      content: String(row.content ?? ""),
      createdAt: String(row.created_at),
    });
    map.set(essayId, current);
  }

  return map;
}

async function fetchEssayItems(essayIds: string[]) {
  const map = new Map<string, Array<{ id: string; recordId: string; sortOrder: number }>>();

  if (essayIds.length === 0) return map;

  const { data, error } = await supabase
    .from("essay_items")
    .select("id, essay_id, record_id, sort_order")
    .in("essay_id", essayIds)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const essayId = String(row.essay_id);
    const current = map.get(essayId) ?? [];
    current.push({
      id: String(row.id),
      recordId: String(row.record_id),
      sortOrder: Number(row.sort_order ?? 0),
    });
    map.set(essayId, current);
  }

  return map;
}

async function fetchFirstPhotoPathByEssay(
  itemMap: Map<string, Array<{ id: string; recordId: string; sortOrder: number }>>,
) {
  const allRecordIds = Array.from(
    new Set(
      Array.from(itemMap.values()).flatMap((items) =>
        items.map((item) => item.recordId),
      ),
    ),
  );

  const photoRowsByRecord = new Map<
    string,
    Array<{ storagePath: string; sortOrder: number; isCover: boolean }>
  >();

  if (allRecordIds.length > 0) {
    const { data, error } = await supabase
      .from("record_photos")
      .select("record_id, storage_path, sort_order, is_cover")
      .in("record_id", allRecordIds)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("에세이 대표 사진 경로 조회 실패:", error);
    } else {
      for (const row of data ?? []) {
        const recordId = String(row.record_id);
        const current = photoRowsByRecord.get(recordId) ?? [];
        current.push({
          storagePath: String(row.storage_path),
          sortOrder: Number(row.sort_order ?? 0),
          isCover: Boolean(row.is_cover),
        });
        photoRowsByRecord.set(recordId, current);
      }
    }
  }

  const result = new Map<string, string>();

  for (const [essayId, items] of itemMap.entries()) {
    const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const item of sortedItems) {
      const photos = [...(photoRowsByRecord.get(item.recordId) ?? [])].sort(
        (a, b) => {
          if (a.isCover !== b.isCover) return a.isCover ? -1 : 1;
          return a.sortOrder - b.sortOrder;
        },
      );

      if (photos[0]?.storagePath) {
        result.set(essayId, photos[0].storagePath);
        break;
      }
    }
  }

  return result;
}

export async function getEssayDashboardData(): Promise<EssayDashboardData> {
  const user = await getRequiredUser();
  await resetStaleGenerationRows(user.id);

  const [nickname, essayResult, journeyResult] = await Promise.all([
    fetchNickname(user.id),
    supabase
      .from("essays")
      .select(
        "id, user_id, journey_id, title, content, status, visibility, selected_version_no, generation_count, generation_state, generation_started_at, published_at, cover_photo_path, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("journeys")
      .select(
        "id, user_id, title, duration_days, target_record_count, start_date, end_date, status, created_at",
      )
      .eq("user_id", user.id)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false }),
  ]);

  if (essayResult.error) throw essayResult.error;
  if (journeyResult.error) throw journeyResult.error;

  const rawEssays = (essayResult.data ?? []) as RawEssay[];
  const rawJourneys = (journeyResult.data ?? []) as RawJourney[];
  const essayIds = rawEssays.map((essay) => String(essay.id));
  const journeyIds = rawJourneys.map((journey) => String(journey.id));

  const versionMap = await fetchEssayVersions(essayIds);
  const itemMap = await fetchEssayItems(essayIds);
  const recordResult =
    journeyIds.length > 0
      ? await supabase
          .from("records")
          .select(
            "id, journey_id, mission_attempt_id, place_id, recorded_at, emotion, content",
          )
          .eq("user_id", user.id)
          .in("journey_id", journeyIds)
          .order("recorded_at", { ascending: true })
      : { data: [], error: null };

  if (recordResult.error) throw recordResult.error;

  const firstPhotoPathMap = await fetchFirstPhotoPathByEssay(itemMap);
  const paths = rawEssays
    .map(
      (essay) =>
        essay.cover_photo_path ?? firstPhotoPathMap.get(String(essay.id)) ?? "",
    )
    .filter(Boolean);
  const signedUrlMap = await createSignedUrlMap(paths);

  const journeyMap = new Map<string, RawJourney>();
  rawJourneys.forEach((journey) => journeyMap.set(String(journey.id), journey));

  const essays: EssaySummary[] = rawEssays.map((essay) => {
    const essayId = String(essay.id);
    const journey = journeyMap.get(String(essay.journey_id));
    const coverPhotoPath =
      essay.cover_photo_path ?? firstPhotoPathMap.get(essayId) ?? null;

    return {
      id: essayId,
      journeyId: String(essay.journey_id),
      journeyTitle: journey?.title ?? "나의 여정",
      durationDays: Number(journey?.duration_days ?? 7),
      startDate: journey?.start_date ?? essay.created_at,
      endDate: journey?.end_date ?? null,
      title: essay.title ?? "나의 에세이",
      content: essay.content ?? "",
      status: essay.status ?? "draft",
      visibility: normalizeVisibility(essay.visibility),
      selectedVersionNo: normalizeVersionNo(essay.selected_version_no),
      generationCount: Number(essay.generation_count ?? 0),
      generationState: normalizeGenerationState(essay.generation_state),
      generationStartedAt: essay.generation_started_at,
      publishedAt: essay.published_at,
      coverPhotoUrl: coverPhotoPath
        ? signedUrlMap.get(coverPhotoPath) ?? null
        : null,
      coverPhotoPath,
      sourceRecordCount: itemMap.get(essayId)?.length ?? 0,
      versionCount: versionMap.get(essayId)?.length ?? 0,
      updatedAt: essay.updated_at,
    };
  });

  const linkedJourneyIds = new Set(
    rawEssays.map((essay) => String(essay.journey_id)),
  );
  const usedRecordIds = new Set(
    Array.from(itemMap.values()).flatMap((items) =>
      items.map((item) => item.recordId),
    ),
  );
  const records = (recordResult.data ?? []) as RawRecord[];

  const candidates = rawJourneys
    .filter((journey) => !linkedJourneyIds.has(String(journey.id)))
    .map((journey): JourneyEssayCandidate => {
      const availableRecords = records.filter(
        (record) =>
          String(record.journey_id) === String(journey.id) &&
          !usedRecordIds.has(String(record.id)),
      );
      const completedDayCount = getCompletedDayCount(availableRecords);
      const targetDayCount = Number(journey.target_record_count ?? 0);

      return {
        id: String(journey.id),
        title: journey.title ?? "나의 여정",
        durationDays: Number(journey.duration_days ?? 0),
        targetDayCount,
        completedDayCount,
        startDate: journey.start_date,
        endDate: journey.end_date,
        status: journey.status === "completed" ? "completed" : "active",
        canCreateEssay:
          targetDayCount > 0 && completedDayCount >= targetDayCount,
      };
    });

  const ready = candidates.find(
    (candidate) => candidate.status === "completed" && candidate.canCreateEssay,
  );
  const active = candidates.find((candidate) => candidate.status === "active");
  const journey = ready ?? active ?? candidates[0] ?? null;

  return { nickname, essays, journey };
}

async function hydrateEssayRecords(
  itemRows: Array<{ id: string; record_id: string; sort_order: number }>,
): Promise<EssayRecord[]> {
  const recordIds = itemRows.map((item) => String(item.record_id));
  if (recordIds.length === 0) return [];

  const { data: recordsData, error: recordsError } = await supabase
    .from("records")
    .select(
      "id, mission_attempt_id, place_id, recorded_at, emotion, content",
    )
    .in("id", recordIds);

  if (recordsError) throw recordsError;

  const records = (recordsData ?? []) as Array<{
    id: string;
    mission_attempt_id: string | null;
    place_id: string | null;
    recorded_at: string;
    emotion: string | null;
    content: string | null;
  }>;

  const attemptIds = Array.from(
    new Set(
      records
        .map((record) => record.mission_attempt_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const attemptMap = new Map<
    string,
    { missionId: string | null; placeId: string | null }
  >();

  if (attemptIds.length > 0) {
    const { data, error } = await supabase
      .from("mission_attempts")
      .select("id, mission_id, place_id")
      .in("id", attemptIds);

    if (error) throw error;

    for (const row of data ?? []) {
      attemptMap.set(String(row.id), {
        missionId: row.mission_id ? String(row.mission_id) : null,
        placeId: row.place_id ? String(row.place_id) : null,
      });
    }
  }

  const missionIds = Array.from(
    new Set(
      Array.from(attemptMap.values())
        .map((attempt) => attempt.missionId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const missionMap = new Map<
    string,
    { title: string; description: string }
  >();

  if (missionIds.length > 0) {
    const { data, error } = await supabase
      .from("missions")
      .select("id, title, short_description, instructions")
      .in("id", missionIds);

    if (error) throw error;

    for (const row of data ?? []) {
      missionMap.set(String(row.id), {
        title: String(row.title ?? "기록한 경험"),
        description: String(
          row.short_description ?? row.instructions ?? "",
        ),
      });
    }
  }

  const placeIds = Array.from(
    new Set(
      records
        .flatMap((record) => {
          const attempt = record.mission_attempt_id
            ? attemptMap.get(record.mission_attempt_id)
            : null;
          return [record.place_id, attempt?.placeId ?? null];
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const placeMap = new Map<string, string>();

  if (placeIds.length > 0) {
    const { data, error } = await supabase
      .from("places")
      .select("id, name")
      .in("id", placeIds);

    if (error) {
      console.warn("에세이 장소 조회 실패:", error);
    } else {
      for (const row of data ?? []) {
        placeMap.set(String(row.id), String(row.name ?? ""));
      }
    }
  }

  const { data: photoRows, error: photoError } = await supabase
    .from("record_photos")
    .select("record_id, storage_path, sort_order, is_cover")
    .in("record_id", recordIds)
    .order("sort_order", { ascending: true });

  if (photoError) {
    console.warn("에세이 원본 사진 조회 실패:", photoError);
  }

  const photosByRecord = new Map<
    string,
    Array<{ path: string; sortOrder: number; isCover: boolean }>
  >();

  for (const row of photoRows ?? []) {
    const recordId = String(row.record_id);
    const current = photosByRecord.get(recordId) ?? [];
    current.push({
      path: String(row.storage_path),
      sortOrder: Number(row.sort_order ?? 0),
      isCover: Boolean(row.is_cover),
    });
    photosByRecord.set(recordId, current);
  }

  const allPaths = Array.from(photosByRecord.values()).flatMap((photos) =>
    photos.map((photo) => photo.path),
  );
  const signedUrlMap = await createSignedUrlMap(allPaths);
  const recordById = new Map(records.map((record) => [String(record.id), record]));

  return [...itemRows]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((item) => {
      const record = recordById.get(String(item.record_id));

      if (!record) return null;

      const attempt = record.mission_attempt_id
        ? attemptMap.get(record.mission_attempt_id)
        : null;
      const mission = attempt?.missionId
        ? missionMap.get(attempt.missionId)
        : null;
      const placeId = record.place_id ?? attempt?.placeId ?? null;
      const photos = [...(photosByRecord.get(String(record.id)) ?? [])].sort(
        (a, b) => {
          if (a.isCover !== b.isCover) return a.isCover ? -1 : 1;
          return a.sortOrder - b.sortOrder;
        },
      );

      return {
        id: String(record.id),
        missionTitle: mission?.title ?? "기록한 경험",
        missionDescription: mission?.description ?? "",
        recordedAt: String(record.recorded_at),
        content: String(record.content ?? ""),
        emotion: record.emotion,
        placeName: placeId ? placeMap.get(placeId) ?? null : null,
        photoUrls: photos
          .map((photo) => signedUrlMap.get(photo.path) ?? null)
          .filter((value): value is string => Boolean(value)),
      } satisfies EssayRecord;
    })
    .filter((value): value is EssayRecord => value !== null);
}

export async function getEssayById(essayId: string): Promise<EssayDetail> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: essayData, error: essayError } = await supabase
    .from("essays")
    .select(
      "id, user_id, journey_id, title, content, status, visibility, selected_version_no, generation_count, generation_state, generation_started_at, published_at, cover_photo_path, created_at, updated_at",
    )
    .eq("id", essayId)
    .maybeSingle();

  if (essayError) throw essayError;
  if (!essayData) throw new Error("에세이를 찾지 못했습니다.");

  const essay = essayData as RawEssay;
  const isOwner = Boolean(user && user.id === essay.user_id);
  const journeyMap = await fetchJourneysByIds([String(essay.journey_id)]);
  const journey = journeyMap.get(String(essay.journey_id));
  const nickname = await fetchNickname(String(essay.user_id));
  const versionMap = isOwner
    ? await fetchEssayVersions([essayId])
    : new Map<string, EssayVersion[]>();

  const { data: itemRows, error: itemError } = await supabase
    .from("essay_items")
    .select("id, record_id, sort_order")
    .eq("essay_id", essayId)
    .order("sort_order", { ascending: true });

  if (itemError) throw itemError;

  const records = await hydrateEssayRecords(
    (itemRows ?? []) as Array<{
      id: string;
      record_id: string;
      sort_order: number;
    }>,
  );

  const coverPhotoPath =
    essay.cover_photo_path ??
    (records[0]?.photoUrls.length ? null : null);
  let coverPhotoUrl =
    records.find((record) => record.photoUrls.length > 0)?.photoUrls[0] ??
    null;

  if (coverPhotoPath) {
    coverPhotoUrl =
      (await createSignedUrlMap([coverPhotoPath])).get(coverPhotoPath) ??
      coverPhotoUrl;
  }

  return {
    id: String(essay.id),
    journeyId: String(essay.journey_id),
    journeyTitle: journey?.title ?? "나의 여정",
    durationDays: Number(journey?.duration_days ?? 7),
    startDate: journey?.start_date ?? essay.created_at,
    endDate: journey?.end_date ?? null,
    title: essay.title ?? "나의 에세이",
    content: essay.content ?? "",
    status: essay.status ?? "draft",
    visibility: normalizeVisibility(essay.visibility),
    selectedVersionNo: normalizeVersionNo(essay.selected_version_no),
    generationCount: Number(essay.generation_count ?? 0),
    generationState: normalizeGenerationState(essay.generation_state),
    generationStartedAt: essay.generation_started_at,
    publishedAt: essay.published_at,
    coverPhotoUrl,
    coverPhotoPath,
    sourceRecordCount: records.length,
    versionCount: versionMap.get(essayId)?.length ?? 0,
    updatedAt: essay.updated_at,
    nickname,
    isOwner,
    versions: versionMap.get(essayId) ?? [],
    records,
  };
}

async function getUserEssayIds(userId: string) {
  const { data, error } = await supabase
    .from("essays")
    .select("id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => String(row.id));
}

export async function createEssayDraft(journeyId: string) {
  const user = await getRequiredUser();

  const { data: existing, error: existingError } = await supabase
    .from("essays")
    .select("id")
    .eq("user_id", user.id)
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return String(existing.id);

  const { data: journey, error: journeyError } = await supabase
    .from("journeys")
    .select("id, title")
    .eq("id", journeyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (journeyError) throw journeyError;
  if (!journey) throw new Error("여정을 찾지 못했습니다.");

  const { data: records, error: recordError } = await supabase
    .from("records")
    .select("id, recorded_at")
    .eq("user_id", user.id)
    .eq("journey_id", journeyId)
    .order("recorded_at", { ascending: true });

  if (recordError) throw recordError;

  const essayIds = await getUserEssayIds(user.id);
  const usedRecordIds = new Set<string>();

  if (essayIds.length > 0) {
    const { data: usedRows, error: usedError } = await supabase
      .from("essay_items")
      .select("record_id")
      .in("essay_id", essayIds);

    if (usedError) throw usedError;
    for (const row of usedRows ?? []) usedRecordIds.add(String(row.record_id));
  }

  const availableRecords = (records ?? []).filter(
    (record) => !usedRecordIds.has(String(record.id)),
  );

  if (availableRecords.length === 0) {
    throw new Error("새 에세이에 담을 기록이 없습니다.");
  }

  const { data: insertedEssay, error: essayError } = await supabase
    .from("essays")
    .insert({
      user_id: user.id,
      journey_id: journeyId,
      title: `${journey.title ?? "나의 여정"}의 기록`,
      content: "",
      status: "draft",
      visibility: "private",
      generation_count: 0,
      generation_state: "idle",
    })
    .select("id")
    .single();

  if (essayError) throw essayError;

  const essayId = String(insertedEssay.id);

  try {
    const { error: itemError } = await supabase.from("essay_items").insert(
      availableRecords.map((record, index) => ({
        essay_id: essayId,
        record_id: record.id,
        sort_order: index,
        ai_bridge_text: "",
      })),
    );

    if (itemError) throw itemError;

    const firstRecordId = String(availableRecords[0].id);
    const { data: firstPhoto } = await supabase
      .from("record_photos")
      .select("storage_path")
      .eq("record_id", firstRecordId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstPhoto?.storage_path) {
      await supabase
        .from("essays")
        .update({ cover_photo_path: firstPhoto.storage_path })
        .eq("id", essayId)
        .eq("user_id", user.id);
    }

    await generateEssayVersion(essayId, "balanced");
    return essayId;
  } catch (error) {
    await supabase
      .from("essays")
      .update({
        generation_state: "error",
        generation_started_at: null,
      })
      .eq("id", essayId)
      .eq("user_id", user.id);

    throw error;
  }
}

function buildEssayPrompt(records: EssayRecord[], style: EssayStyle) {
  const styleInstructions: Record<EssayStyle, string> = {
    plain:
      "행동과 사실을 중심으로 쓰고 감정 표현은 최소화한다. 문장은 짧고 담백하게 쓴다.",
    balanced:
      "담담한 사실 전달을 중심으로 하되 분위기와 감정을 은은하게 담는다.",
    emotional:
      "장면의 분위기와 여운을 조금 더 살리되 과장하거나 오글거리는 표현은 사용하지 않는다.",
  };

  const recordCount = records.length;
  const lengthGuide =
    recordCount <= 4
      ? "약 700~1,100자"
      : recordCount <= 8
        ? "약 1,000~1,500자"
        : "최대 약 2,000자";

  const sourceText = records
    .map((record, index) => {
      const emotion = record.emotion
        ? EMOTION_LABELS[record.emotion] ?? record.emotion
        : "선택하지 않음";

      return [
        `[기록 ${index + 1}]`,
        `날짜: ${normalizeDateKey(record.recordedAt)}`,
        `미션 제목: ${record.missionTitle}`,
        `미션 설명: ${record.missionDescription || "없음"}`,
        `장소: ${record.placeName || "장소 정보 없음"}`,
        `선택 감정: ${emotion}`,
        `사용자 원문: ${record.content || "내용 없음"}`,
      ].join("\n");
    })
    .join("\n\n");

  return `너는 사용자의 Journey 기록을 하나의 블로그형 에세이 초안으로 재구성하는 편집자다.

[글의 목적]
- 깊은 자기성찰문보다 Journey 동안 보낸 일상을 다른 사람에게 자연스럽게 소개하는 블로그형 글이다.
- 사용자가 직접 쓴 것 같은 1인칭 문체를 사용한다. 필요할 때 '나는', '내가'를 자연스럽게 쓴다.
- 감성적이지만 오글거리지 않고, 담담한 문장 안에서 은은하게 감정이 느껴져야 한다.
- 거창한 깨달음, 인생의 전환점, SNS 감성 문구를 만들지 않는다.

[현재 문체]
${STYLE_LABELS[style]}: ${styleInstructions[style]}

[사실 사용 규칙]
- 아래 기록에 없는 사건, 사람, 대화, 행동을 새로 만들지 않는다.
- 사용자가 느끼지 않은 강한 감정을 단정하지 않는다.
- 미션 설명의 의도를 실제 사용자 감정으로 단정하지 않는다.
- 자연스러운 연결을 위한 최소한의 분위기 묘사는 가능하지만 구체적 사실은 기록을 벗어나면 안 된다.
- 기록 날짜순을 반드시 지킨다. AI가 활동 순서를 바꾸거나 새로운 인과관계를 만들면 안 된다.
- 비슷한 활동과 감정은 묶어 압축할 수 있지만 주요 활동을 완전히 없애지 않는다.
- 사용자의 원문을 그대로 이어 붙이지 말고 하나의 연속된 글로 다시 쓴다.
- 미션마다 소제목을 붙이거나 날짜·미션명을 본문에 억지로 반복하지 않는다.
- 도입과 마무리는 각각 1~2문장 정도로 짧게 쓴다.
- 권장 분량은 ${lengthGuide}이며 기록이 짧으면 억지로 채우지 않는다.

[출력 형식]
반드시 아래 JSON 하나만 반환한다. 코드블록과 설명은 쓰지 않는다.
{"title":"에세이 제목","content":"완성된 에세이 전체 본문"}

[기록]
${sourceText}`;
}

function parseEssayResponse(answer: string) {
  const trimmed = answer.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(
        withoutFence.slice(firstBrace, lastBrace + 1),
      ) as { title?: unknown; content?: unknown };
      const title = String(parsed.title ?? "").trim();
      const content = String(parsed.content ?? "").trim();

      if (title && content) return { title, content };
    } catch {
      // Fall through to a plain-text recovery path.
    }
  }

  const lines = withoutFence
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = (lines.shift() ?? "나의 Journey 기록").replace(
    /^제목\s*[:：]\s*/,
    "",
  );
  const content = lines.join("\n\n").replace(/^본문\s*[:：]\s*/, "");

  if (!content) {
    throw new Error("AI가 완성된 에세이 본문을 반환하지 않았습니다.");
  }

  return { title, content };
}

export async function generateEssayVersion(
  essayId: string,
  requestedStyle: EssayStyle,
) {
  const user = await getRequiredUser();
  const { data: essay, error: essayError } = await supabase
    .from("essays")
    .select("id, user_id, selected_version_no")
    .eq("id", essayId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (essayError) throw essayError;
  if (!essay) throw new Error("에세이를 찾지 못했습니다.");
  if (essay.selected_version_no) {
    throw new Error("최종 버전을 선택한 뒤에는 AI로 다시 만들 수 없습니다.");
  }

  const { data: existingVersions, error: versionError } = await supabase
    .from("essay_versions")
    .select("version_no")
    .eq("essay_id", essayId)
    .order("version_no", { ascending: true });

  if (versionError) throw versionError;

  const versionNo = ((existingVersions?.length ?? 0) + 1) as 1 | 2;

  if (versionNo > 2) {
    throw new Error("AI 생성본은 최대 두 개까지만 만들 수 있습니다.");
  }

  const style: EssayStyle = versionNo === 1 ? "balanced" : requestedStyle;

  await supabase
    .from("essays")
    .update({
      generation_state: "generating",
      generation_started_at: new Date().toISOString(),
    })
    .eq("id", essayId)
    .eq("user_id", user.id);

  try {
    const detail = await getEssayById(essayId);

    if (detail.records.length === 0) {
      throw new Error("에세이에 연결된 기록이 없습니다.");
    }

    const prompt = buildEssayPrompt(detail.records, style);
    const { data, error } = await supabase.functions.invoke<{
      answer?: string;
    }>("upstage-test", {
      body: { message: prompt },
    });

    if (error) throw error;
    if (!data?.answer) {
      throw new Error("AI 에세이 결과가 없습니다.");
    }

    const generated = parseEssayResponse(data.answer);
    const { data: inserted, error: insertError } = await supabase
      .from("essay_versions")
      .insert({
        essay_id: essayId,
        version_no: versionNo,
        style,
        title: generated.title,
        content: generated.content,
      })
      .select("id, version_no, style, title, content, created_at")
      .single();

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from("essays")
      .update({
        generation_count: versionNo,
        generation_state: "idle",
        generation_started_at: null,
      })
      .eq("id", essayId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return {
      id: String(inserted.id),
      versionNo: Number(inserted.version_no) as 1 | 2,
      style: inserted.style as EssayStyle,
      title: String(inserted.title),
      content: String(inserted.content),
      createdAt: String(inserted.created_at),
    } satisfies EssayVersion;
  } catch (error) {
    await supabase
      .from("essays")
      .update({
        generation_state: "error",
        generation_started_at: null,
      })
      .eq("id", essayId)
      .eq("user_id", user.id);

    throw new Error(
      getErrorMessage(error, "AI 에세이를 생성하지 못했습니다."),
    );
  }
}

export async function selectEssayVersion(
  essayId: string,
  versionNo: 1 | 2,
) {
  const user = await getRequiredUser();

  const { data: version, error: versionError } = await supabase
    .from("essay_versions")
    .select("title, content")
    .eq("essay_id", essayId)
    .eq("version_no", versionNo)
    .maybeSingle();

  if (versionError) throw versionError;
  if (!version) throw new Error("선택한 AI 버전을 찾지 못했습니다.");

  const { error: essayError } = await supabase
    .from("essays")
    .update({
      title: version.title,
      content: version.content,
      selected_version_no: versionNo,
      visibility: "private",
      status: "draft",
      published_at: null,
      generation_state: "idle",
      generation_started_at: null,
    })
    .eq("id", essayId)
    .eq("user_id", user.id);

  if (essayError) throw essayError;

  const { error: deleteError } = await supabase
    .from("essay_versions")
    .delete()
    .eq("essay_id", essayId)
    .neq("version_no", versionNo);

  if (deleteError) throw deleteError;
}

export async function saveEssayDraft(
  essayId: string,
  values: { title: string; content: string },
) {
  const user = await getRequiredUser();
  const title = values.title.trim();
  const content = values.content.trim();

  if (!title) throw new Error("제목을 입력해주세요.");
  if (!content) throw new Error("본문을 입력해주세요.");

  const { error } = await supabase
    .from("essays")
    .update({
      title,
      content,
      status: "draft",
      visibility: "private",
      published_at: null,
    })
    .eq("id", essayId)
    .eq("user_id", user.id);

  if (error) throw error;
}

export async function publishEssay(essayId: string) {
  const user = await getRequiredUser();
  const { data: essay, error: readError } = await supabase
    .from("essays")
    .select("title, content, selected_version_no")
    .eq("id", essayId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (!essay) throw new Error("에세이를 찾지 못했습니다.");
  if (!essay.selected_version_no) {
    throw new Error("먼저 AI 버전을 하나 선택해주세요.");
  }
  if (!String(essay.title ?? "").trim() || !String(essay.content ?? "").trim()) {
    throw new Error("제목과 본문을 작성해주세요.");
  }

  const { error } = await supabase
    .from("essays")
    .update({
      visibility: "public",
      status: "completed",
      published_at: new Date().toISOString(),
    })
    .eq("id", essayId)
    .eq("user_id", user.id);

  if (error) throw error;
}