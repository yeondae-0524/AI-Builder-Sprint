import { supabase } from "../lib/supabase";

const ESSAY_FUNCTION_NAME =
  String(
    process.env.EXPO_PUBLIC_ESSAY_FUNCTION_NAME ?? "generate-essay",
  ).trim() || "generate-essay";

export type EssayStyle = "plain" | "balanced" | "emotional";
export type EssayVisibility = "private" | "public";
export type EssayGenerationState = "idle" | "generating" | "error";
export type EssayKind = "taste_report" | "postcard";
export type PostcardFormat = "story" | "square";
export type EssayVersionNo = 1 | 2 | 3;

export type EssayInsight = {
  keyword: string;
  description: string;
};

export type EssayGenerationMeta = {
  insights: EssayInsight[];
  aiRecommendation: string;
  hashtags: string[];
  themeColor: string;
  accentColor: string;
};

export type EssayVersion = {
  id: string;
  versionNo: EssayVersionNo;
  style: EssayStyle;
  kind: EssayKind;
  postcardFormat: PostcardFormat | null;
  title: string;
  content: string;
  meta: EssayGenerationMeta;
  createdAt: string;
};

export type EssayRecord = {
  id: string;
  missionTitle: string;
  missionDescription: string;
  categoryName: string | null;
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
  kind: EssayKind;
  postcardFormat: PostcardFormat | null;
  status: string;
  visibility: EssayVisibility;
  selectedVersionNo: EssayVersionNo | null;
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
  selectedMeta: EssayGenerationMeta;
  versions: EssayVersion[];
  records: EssayRecord[];
};

export type CreateEssayDraftOptions = {
  kind: EssayKind;
  postcardFormat?: PostcardFormat | null;
};

export type GenerateEssayVersionOptions = {
  kind: EssayKind;
  postcardFormat?: PostcardFormat | null;
};

type RawEssay = {
  id: string;
  user_id: string;
  journey_id: string;
  title: string | null;
  content: string | null;
  essay_type: string | null;
  postcard_format: string | null;
  selected_payload: unknown;
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
  status: string;
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

const ESSAY_COLUMNS =
  "id, user_id, journey_id, title, content, essay_type, postcard_format, selected_payload, status, visibility, selected_version_no, generation_count, generation_state, generation_started_at, published_at, cover_photo_path, created_at, updated_at";

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();

    if (message) return message;
  }

  return fallback;
}

function normalizeDateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
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
  return value === "generating" || value === "error" ? value : "idle";
}

function normalizeVersionNo(value: number | null): EssayVersionNo | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function normalizeEssayKind(value: string | null | undefined): EssayKind {
  return value === "postcard" ? "postcard" : "taste_report";
}

function normalizePostcardFormat(
  value: string | null | undefined,
): PostcardFormat | null {
  return value === "story" || value === "square" ? value : null;
}

function normalizeHexColor(value: unknown, fallback: string) {
  const candidate = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function normalizeGenerationMeta(value: unknown): EssayGenerationMeta {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  const insights = Array.isArray(raw.insights)
    ? raw.insights
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const keyword = String(record.keyword ?? "").trim();
          const description = String(record.description ?? "").trim();
          return keyword && description ? { keyword, description } : null;
        })
        .filter((item): item is EssayInsight => item !== null)
        .slice(0, 4)
    : [];

  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags
        .map((tag) => String(tag ?? "").trim())
        .filter(Boolean)
        .map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
        .slice(0, 6)
    : [];

  return {
    insights,
    aiRecommendation: String(raw.aiRecommendation ?? "").trim(),
    hashtags,
    themeColor: normalizeHexColor(raw.themeColor, "#F4F1EA"),
    accentColor: normalizeHexColor(raw.accentColor, "#3D5AFE"),
  };
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


async function getFreshAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (!data.session) {
    throw new Error("로그인이 필요합니다.");
  }

  const expiresAtMs = (data.session.expires_at ?? 0) * 1000;
  const shouldRefresh = expiresAtMs <= Date.now() + 60_000;

  if (!shouldRefresh) {
    return data.session.access_token;
  }

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession();

  if (refreshError) throw refreshError;
  if (!refreshed.session) {
    throw new Error("로그인 정보를 새로고침하지 못했습니다.");
  }

  return refreshed.session.access_token;
}

async function getFunctionInvokeErrorMessage(error: unknown) {
  const fallback = getErrorMessage(
    error,
    "Edge Function 호출에 실패했습니다.",
  );

  if (!error || typeof error !== "object" || !("context" in error)) {
    return fallback;
  }

  try {
    const context = (error as { context?: unknown }).context as {
      clone?: () => { text?: () => Promise<string> };
      text?: () => Promise<string>;
      status?: number;
    } | undefined;

    const responseLike = context?.clone?.() ?? context;
    const raw = await responseLike?.text?.();

    if (!raw?.trim()) return fallback;

    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const detail = String(
        payload.error ??
          payload.message ??
          payload.msg ??
          payload.details ??
          "",
      ).trim();

      if (detail) return detail;
    } catch {
      return raw.trim();
    }
  } catch {
    // 응답 본문을 읽지 못하면 기본 오류 문구를 사용한다.
  }

  return fallback;
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
    .select(
      "id, essay_id, version_no, style, essay_type, postcard_format, title, content, payload, created_at",
    )
    .in("essay_id", essayIds)
    .order("version_no", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const essayId = String(row.essay_id);
    const current = map.get(essayId) ?? [];

    current.push({
      id: String(row.id),
      versionNo: Number(row.version_no) as EssayVersionNo,
      style: row.style as EssayStyle,
      kind: normalizeEssayKind(row.essay_type),
      postcardFormat: normalizePostcardFormat(row.postcard_format),
      title: String(row.title ?? "나의 에세이"),
      content: String(row.content ?? ""),
      meta: normalizeGenerationMeta(row.payload),
      createdAt: String(row.created_at),
    });

    map.set(essayId, current);
  }

  return map;
}

type EssayItem = {
  id: string;
  recordId: string;
  sortOrder: number;
};

async function fetchEssayItems(essayIds: string[]) {
  const map = new Map<string, EssayItem[]>();
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
  itemMap: Map<string, EssayItem[]>,
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
      .select(ESSAY_COLUMNS)
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
        essay.cover_photo_path ??
        firstPhotoPathMap.get(String(essay.id)) ??
        "",
    )
    .filter(Boolean);
  const signedUrlMap = await createSignedUrlMap(paths);

  const journeyMap = new Map<string, RawJourney>();
  rawJourneys.forEach((journey) => {
    journeyMap.set(String(journey.id), journey);
  });

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
      kind: normalizeEssayKind(essay.essay_type),
      postcardFormat: normalizePostcardFormat(essay.postcard_format),
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
    (candidate) =>
      candidate.status === "completed" && candidate.canCreateEssay,
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
    .select("id, mission_attempt_id, place_id, recorded_at, emotion, content")
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
    { title: string; description: string; categoryId: string | null }
  >();
  const categoryMap = new Map<string, string>();

  if (missionIds.length > 0) {
    const { data, error } = await supabase
      .from("missions")
      .select("id, title, short_description, instructions, category_id")
      .in("id", missionIds);

    if (error) throw error;

    const categoryIds = Array.from(
      new Set(
        (data ?? [])
          .map((row) => row.category_id ? String(row.category_id) : null)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (categoryIds.length > 0) {
      const { data: categories, error: categoryError } = await supabase
        .from("mission_categories")
        .select("id, name")
        .in("id", categoryIds);

      if (categoryError) {
        console.warn("에세이 미션 카테고리 조회 실패:", categoryError);
      } else {
        for (const category of categories ?? []) {
          categoryMap.set(String(category.id), String(category.name ?? ""));
        }
      }
    }

    for (const row of data ?? []) {
      missionMap.set(String(row.id), {
        title: String(row.title ?? "기록한 경험"),
        description: String(
          row.short_description ?? row.instructions ?? "",
        ),
        categoryId: row.category_id ? String(row.category_id) : null,
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
  const recordById = new Map(
    records.map((record) => [String(record.id), record]),
  );

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
        categoryName: mission?.categoryId
          ? categoryMap.get(mission.categoryId) ?? null
          : null,
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
    .select(ESSAY_COLUMNS)
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

  const coverPhotoPath = essay.cover_photo_path ?? null;
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
    kind: normalizeEssayKind(essay.essay_type),
    postcardFormat: normalizePostcardFormat(essay.postcard_format),
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
    selectedMeta: normalizeGenerationMeta(essay.selected_payload),
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

export async function createEssayDraft(
  journeyId: string,
  options: CreateEssayDraftOptions,
) {
  const user = await getRequiredUser();
  const kind = normalizeEssayKind(options.kind);
  const postcardFormat = kind === "postcard"
    ? normalizePostcardFormat(options.postcardFormat) ?? "story"
    : null;

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

    for (const row of usedRows ?? []) {
      usedRecordIds.add(String(row.record_id));
    }
  }

  const availableRecords = (records ?? []).filter(
    (record) => !usedRecordIds.has(String(record.id)),
  );

  if (availableRecords.length === 0) {
    throw new Error("새 에세이에 담을 기록이 없습니다.");
  }

  const initialTitle = kind === "taste_report"
    ? `${journey.title ?? "나의 여정"} 취향 리포트`
    : `${journey.title ?? "나의 여정"} 엽서`;

  const { data: insertedEssay, error: essayError } = await supabase
    .from("essays")
    .insert({
      user_id: user.id,
      journey_id: journeyId,
      title: initialTitle,
      content: "",
      essay_type: kind,
      postcard_format: postcardFormat,
      selected_payload: {},
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
    const { data: firstPhoto, error: firstPhotoError } = await supabase
      .from("record_photos")
      .select("storage_path")
      .eq("record_id", firstRecordId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstPhotoError) {
      console.warn("에세이 대표 사진 조회 실패:", firstPhotoError);
    }

    if (firstPhoto?.storage_path) {
      const { error: coverError } = await supabase
        .from("essays")
        .update({ cover_photo_path: firstPhoto.storage_path })
        .eq("id", essayId)
        .eq("user_id", user.id);

      if (coverError) {
        console.warn("에세이 대표 사진 저장 실패:", coverError);
      }
    }

    await generateEssayVersion(essayId, {
      kind,
      postcardFormat,
    });
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

function buildRecordPayload(records: EssayRecord[]) {
  return records.map((record) => ({
    missionTitle: record.missionTitle,
    missionDescription: record.missionDescription,
    category: record.categoryName,
    recordedAt: record.recordedAt,
    userContent: record.content,
    emotion: record.emotion
      ? EMOTION_LABELS[record.emotion] ?? record.emotion
      : null,
    placeName: record.placeName,
    photoUrls: record.photoUrls,
  }));
}

function getWeekLabel(durationDays: number) {
  const weekCount = Math.max(1, Math.ceil(durationDays / 7));
  return `${weekCount}주`;
}

type TasteReportAiResult = {
  title?: unknown;
  content?: unknown;
  summary?: unknown;
  insights?: unknown;
  aiRecommendation?: unknown;
};

type PostcardAiResult = {
  titleCardText?: unknown;
  bodyCardText?: unknown;
  hashtags?: unknown;
  themeColor?: unknown;
  accentColor?: unknown;
};

function normalizeTasteReportResult(
  result: TasteReportAiResult,
  detail: EssayDetail,
) {
  const meta = normalizeGenerationMeta({
    insights: result.insights,
    aiRecommendation: result.aiRecommendation,
  });
  const title = String(result.title ?? "").trim() ||
    `AI가 분석한 ${detail.nickname}님의 ${getWeekLabel(detail.durationDays)}`;
  const content = String(result.content ?? result.summary ?? "").trim();

  if (!content) {
    throw new Error("AI가 취향 리포트 본문을 반환하지 않았습니다.");
  }

  return { title, content, meta };
}

function normalizePostcardResult(result: PostcardAiResult) {
  const title = String(result.titleCardText ?? "").trim();
  const content = String(result.bodyCardText ?? "").trim();
  const meta = normalizeGenerationMeta({
    hashtags: result.hashtags,
    themeColor: result.themeColor,
    accentColor: result.accentColor,
  });

  if (!title || !content) {
    throw new Error("AI가 엽서 제목과 본문을 반환하지 않았습니다.");
  }

  return { title, content, meta };
}

export async function generateEssayVersion(
  essayId: string,
  options: GenerateEssayVersionOptions,
) {
  const user = await getRequiredUser();
  const requestedKind = normalizeEssayKind(options.kind);
  const requestedPostcardFormat = requestedKind === "postcard"
    ? normalizePostcardFormat(options.postcardFormat) ?? "story"
    : null;

  const { data: essay, error: essayError } = await supabase
    .from("essays")
    .select("id, user_id, selected_version_no, essay_type, postcard_format")
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

  const versionNo = ((existingVersions?.length ?? 0) + 1) as EssayVersionNo;
  if (versionNo > 3) {
    throw new Error("다시 만들기는 최대 두 번까지 사용할 수 있습니다.");
  }

  // 기존 DB의 style 필드는 호환성을 위해 유지하지만,
  // 다시 만들기에서는 말투가 아니라 결과 형식을 선택합니다.
  const style: EssayStyle = "balanced";

  const { error: startError } = await supabase
    .from("essays")
    .update({
      generation_state: "generating",
      generation_started_at: new Date().toISOString(),
    })
    .eq("id", essayId)
    .eq("user_id", user.id);

  if (startError) throw startError;

  try {
    const detail = await getEssayById(essayId);

    if (detail.records.length === 0) {
      throw new Error("에세이에 연결된 기록이 없습니다.");
    }

    const recordPayload = buildRecordPayload(detail.records);
    const accessToken = await getFreshAccessToken();

    // generate-essay 함수는 취향 리포트와 SNS 엽서 모두
    // records 배열을 사용해 기록을 분석합니다.
    const functionBody = {
      type: requestedKind === "postcard" ? "sns-feed" : "taste-report",
      nickname: detail.nickname,
      journeyTitle: detail.journeyTitle,
      durationDays: detail.durationDays,
      style,
      postcardFormat: requestedPostcardFormat ?? "story",
      records: recordPayload,
    };

    const { data, error } = await supabase.functions.invoke<Record<string, unknown>>(
      ESSAY_FUNCTION_NAME,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: functionBody,
      },
    );

    if (error) {
      throw new Error(await getFunctionInvokeErrorMessage(error));
    }
    if (!data) throw new Error("AI 생성 결과가 없습니다.");
    if (typeof data.error === "string" && data.error.trim()) {
      throw new Error(data.error);
    }

    const generated = requestedKind === "postcard"
      ? normalizePostcardResult(data as PostcardAiResult)
      : normalizeTasteReportResult(data as TasteReportAiResult, detail);

    const { data: inserted, error: insertError } = await supabase
      .from("essay_versions")
      .insert({
        essay_id: essayId,
        version_no: versionNo,
        style,
        essay_type: requestedKind,
        postcard_format: requestedPostcardFormat,
        title: generated.title,
        content: generated.content,
        payload: generated.meta,
      })
      .select(
        "id, version_no, style, essay_type, postcard_format, title, content, payload, created_at",
      )
      .single();

    if (insertError) throw insertError;

    const { error: finishError } = await supabase
      .from("essays")
      .update({
        generation_count: versionNo,
        generation_state: "idle",
        generation_started_at: null,
      })
      .eq("id", essayId)
      .eq("user_id", user.id);

    if (finishError) throw finishError;

    return {
      id: String(inserted.id),
      versionNo: Number(inserted.version_no) as EssayVersionNo,
      style: inserted.style as EssayStyle,
      kind: normalizeEssayKind(inserted.essay_type),
      postcardFormat: normalizePostcardFormat(inserted.postcard_format),
      title: String(inserted.title),
      content: String(inserted.content),
      meta: normalizeGenerationMeta(inserted.payload),
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
  versionNo: EssayVersionNo,
) {
  const user = await getRequiredUser();

  const { data: version, error: versionError } = await supabase
    .from("essay_versions")
    .select("title, content, payload, essay_type, postcard_format")
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
      selected_payload: version.payload ?? {},
      selected_version_no: versionNo,
      essay_type: normalizeEssayKind(version.essay_type),
      postcard_format: normalizePostcardFormat(version.postcard_format),
      visibility: "private",
      status: "draft",
      published_at: null,
      generation_state: "idle",
      generation_started_at: null,
    })
    .eq("id", essayId)
    .eq("user_id", user.id);

  if (essayError) throw essayError;
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
  if (
    !String(essay.title ?? "").trim() ||
    !String(essay.content ?? "").trim()
  ) {
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