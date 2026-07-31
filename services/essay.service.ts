import { supabase } from "@/lib/supabase";
import { getChallengeRecommendation } from "./upstage";

export type CreateEssayDraftInput = {
  journeyId: string;
  title: string;
};

/**
 * Supabase의 중첩 관계가 객체 또는 배열로 반환될 때
 * 첫 번째 객체를 안전하게 꺼낸다.
 */
function getSingleRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

/**
 * 완료된 Journey의 기록들을 묶어 에세이 초안을 생성한다.
 * 이미 에세이가 있으면 기존 essayId를 반환한다.
 */
export async function createEssayDraft({
  journeyId,
  title,
}: CreateEssayDraftInput): Promise<string> {
  if (!journeyId.trim()) {
    throw new Error("journeyId가 필요합니다.");
  }
  if (!title.trim()) {
    throw new Error("에세이 제목이 필요합니다.");
  }

  const { data, error } = await supabase.rpc(
    "create_essay_draft",
    {
      p_journey_id: journeyId,
      p_title: title.trim(),
    },
  );

  if (error) {
    console.error("createEssayDraft Error:", error);
    throw error;
  }
  if (!data) {
    throw new Error("에세이 초안을 생성하지 못했습니다.");
  }

  return data as string;
}

/**
 * 현재 로그인한 사용자의 에세이 목록을 조회한다.
 */
export async function getMyEssays() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
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
      updated_at,
      journeys (
        id,
        title,
        duration_days,
        target_record_count,
        start_date,
        end_date,
        status
      ),
      essay_items (
        id,
        record_id,
        sort_order
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyEssays Error:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * 본인의 특정 에세이와 연결된 기록을 상세 조회한다.
 */
export async function getEssayById(essayId: string) {
  if (!essayId.trim()) throw new Error("essayId가 필요합니다.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
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
      updated_at,
      journeys (
        id,
        title,
        duration_days,
        target_record_count,
        start_date,
        end_date,
        status
      ),
      essay_items (
        id,
        record_id,
        ai_bridge_text,
        sort_order,
        created_at,
        records (
          id,
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
        )
      )
    `)
    .eq("id", essayId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getEssayById Error:", error);
    throw error;
  }
  if (!data) {
    throw new Error("에세이를 찾을 수 없거나 접근 권한이 없습니다.");
  }

  return {
    ...data,
    essay_items: [...(data.essay_items ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

export type EssayVisibility = "private" | "anonymous" | "nickname";
export type EssayStatus = "draft" | "completed";

export type UpdateEssayInput = {
  title?: string;
  visibility?: EssayVisibility;
  status?: EssayStatus;
  coverPhotoPath?: string | null;
};

/**
 * 본인의 에세이 제목, 공개 범위, 상태, 표지 사진을 수정한다.
 */
export async function updateEssay(essayId: string, input: UpdateEssayInput) {
  if (!essayId.trim()) throw new Error("essayId가 필요합니다.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  if (input.title !== undefined && !input.title.trim()) {
    throw new Error("에세이 제목은 비워둘 수 없습니다.");
  }

  const updateData: {
    title?: string;
    visibility?: EssayVisibility;
    status?: EssayStatus;
    cover_photo_path?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.visibility !== undefined) updateData.visibility = input.visibility;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.coverPhotoPath !== undefined) updateData.cover_photo_path = input.coverPhotoPath;

  const { data, error } = await supabase
    .from("essays")
    .update(updateData)
    .eq("id", essayId)
    .eq("user_id", user.id)
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
    .maybeSingle();

  if (error) {
    console.error("updateEssay Error:", error);
    throw error;
  }
  if (!data) {
    throw new Error("에세이를 찾을 수 없거나 수정 권한이 없습니다.");
  }

  return data;
}

/**
 * 본인의 에세이를 삭제한다.
 */
export async function deleteEssay(essayId: string) {
  if (!essayId.trim()) throw new Error("essayId가 필요합니다.");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("essays")
    .delete()
    .eq("id", essayId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteEssay Error:", error);
    throw error;
  }
  if (!data) {
    throw new Error("에세이를 찾을 수 없거나 삭제 권한이 없습니다.");
  }

  return {
    success: true as const,
    deletedEssayId: data.id,
  };
}

/**
 * 에세이에 연결된 기록들을 AI 입력용 텍스트로 변환한다.
 */
export async function getEssayPromptData(essayId: string) {
  const essay = await getEssayById(essayId);
  const items = [...(essay.essay_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  if (items.length === 0) {
    throw new Error("에세이를 생성할 기록이 없습니다.");
  }

  const recordBlocks = items
    .map((item, index) => {
      const record = getSingleRelation(item.records);
      if (!record) return null;

      const missionAttempt = getSingleRelation(record.mission_attempts);
      const mission = getSingleRelation(missionAttempt?.missions);
      const place = getSingleRelation(record.places);

      const missionTitle = mission?.title ?? "미션 정보 없음";
      const placeName = place?.name ?? "장소 정보 없음";

      return [
        `[기록 ${index + 1}]`,
        `날짜: ${record.recorded_at}`,
        `미션: ${missionTitle}`,
        `장소: ${placeName}`,
        `감정: ${record.emotion}`,
        `내용: ${record.content}`,
      ].join("\n");
    })
    .filter((value): value is string => typeof value === "string");

  if (recordBlocks.length === 0) {
    throw new Error("AI에 전달할 기록 내용이 없습니다.");
  }

  return {
    essayId: essay.id,
    journeyId: essay.journey_id,
    currentTitle: essay.title,
    recordCount: recordBlocks.length,
    recordsText: recordBlocks.join("\n\n"),
  };
}

export function createEssayGenerationPrompt(
  recordsText: string,
  recordCount: number,
) {
  if (recordCount < 1) {
    throw new Error("에세이를 생성할 기록이 없습니다.");
  }

  const bridgeTemplate = Array.from(
    { length: recordCount },
    (_, index) => `    {
      "recordIndex": ${index},
      "bridgeText": "${index + 1}번째 기록을 자연스럽게 소개하거나 이어주는 문장"
    }`,
  ).join(",\n");

  return `
다음은 한 사용자가 Journey 동안 작성한 실제 경험 기록입니다.

${recordsText}

위 기록만을 바탕으로 하나의 자연스러운 한국어 에세이를 구성하세요.

반드시 지켜야 할 규칙:
- 기록에 없는 사실을 만들어내지 마세요.
- 사용자의 감정 변화와 경험의 흐름을 중심으로 작성하세요.
- 과장되거나 지나치게 감성적인 문장은 피하세요.
- 실제 기록은 총 ${recordCount}개입니다.
- bridges 배열도 반드시 정확히 ${recordCount}개여야 합니다.
- recordIndex는 0부터 ${recordCount - 1}까지 각각 한 번씩만 사용하세요.
- recordIndex를 빠뜨리거나 중복해서는 안 됩니다.
- 설명이나 마크다운 없이 JSON 객체만 반환하세요.

반환 형식:

{
  "title": "에세이 제목",
  "bridges": [
${bridgeTemplate}
  ]
}
`.trim();
}

type EssayAiBridge = {
  recordIndex: number;
  bridgeText: string;
};

type EssayAiResult = {
  title: string;
  bridges: EssayAiBridge[];
};

/**
 * AI가 반환한 문자열에서 JSON만 추출하고 검증한다.
 */
function parseEssayAiResult(rawAnswer: string): EssayAiResult {
  const trimmed = rawAnswer.trim();

  // AI가 ```json 코드 블록으로 응답한 경우 제거
  const withoutCodeBlock = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const firstBrace = withoutCodeBlock.indexOf("{");
  const lastBrace = withoutCodeBlock.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");
  }

  const jsonText = withoutCodeBlock.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI 응답을 JSON으로 변환하지 못했습니다.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }

  const result = parsed as { title?: unknown; bridges?: unknown };

  if (typeof result.title !== "string" || !result.title.trim()) {
    throw new Error("AI가 제목을 생성하지 않았습니다.");
  }

  if (!Array.isArray(result.bridges)) {
    throw new Error("AI가 연결 문장 목록을 생성하지 않았습니다.");
  }

  const bridges = result.bridges.map((bridge, index): EssayAiBridge => {
    if (typeof bridge !== "object" || bridge === null) {
      throw new Error(`${index + 1}번째 연결 문장 형식이 올바르지 않습니다.`);
    }

    const item = bridge as { recordIndex?: unknown; bridgeText?: unknown };

    if (
      typeof item.recordIndex !== "number" ||
      !Number.isInteger(item.recordIndex) ||
      item.recordIndex < 0
    ) {
      throw new Error(`${index + 1}번째 recordIndex가 올바르지 않습니다.`);
    }

    if (typeof item.bridgeText !== "string" || !item.bridgeText.trim()) {
      throw new Error(`${index + 1}번째 연결 문장이 비어 있습니다.`);
    }

    return {
      recordIndex: item.recordIndex,
      bridgeText: item.bridgeText.trim(),
    };
  });

  return {
    title: result.title.trim(),
    bridges,
  };
}

/**
 * bridges 개수와 recordIndex가 실제 기록 개수와 정확히 일치하는지 확인한다.
 */
function hasExactBridgeIndexes(
  result: EssayAiResult,
  recordCount: number,
): boolean {
  if (result.bridges.length !== recordCount) return false;

  const indexes = result.bridges
    .map((bridge) => bridge.recordIndex)
    .sort((a, b) => a - b);

  return indexes.every((recordIndex, index) => recordIndex === index);
}

/**
 * 에세이에 연결된 실제 기록을 Upstage에 전달하고,
 * 생성된 제목과 연결 문장을 DB에 저장한다.
 */
export async function generateAndSaveEssay(essayId: string) {
  if (!essayId.trim()) throw new Error("essayId가 필요합니다.");

  // 1. 실제 기록을 AI 입력용 데이터로 변환
  const { recordsText, recordCount } = await getEssayPromptData(essayId);

  // 2. 실제 기록 개수에 맞춘 AI 프롬프트 생성
  const prompt = createEssayGenerationPrompt(recordsText, recordCount);

  // 3. 첫 번째 Upstage 호출
  const rawAnswer = await getChallengeRecommendation(prompt);

  // 4. AI 응답 JSON 변환 및 검증
  let aiResult = parseEssayAiResult(rawAnswer);

  // bridges 개수나 인덱스가 틀리면 한 번 자동 교정 요청
  if (!hasExactBridgeIndexes(aiResult, recordCount)) {
    const retryPrompt = `
${prompt}

이전 응답은 bridges 개수 또는 recordIndex가 잘못되었습니다.

이전 응답:
${rawAnswer}

반드시 아래 조건을 지켜 다시 JSON 객체만 반환하세요.
- bridges는 정확히 ${recordCount}개
- recordIndex는 0부터 ${recordCount - 1}까지
- 각 recordIndex는 정확히 한 번만 사용
- 설명이나 마크다운을 작성하지 않음
`.trim();

    const retryAnswer = await getChallengeRecommendation(retryPrompt);
    aiResult = parseEssayAiResult(retryAnswer);
  }

  if (!hasExactBridgeIndexes(aiResult, recordCount)) {
    throw new Error(
      `AI가 기록 ${recordCount}개에 맞는 연결 문장을 생성하지 못했습니다. 다시 시도해주세요.`,
    );
  }

  const sortedBridges = [...aiResult.bridges].sort(
    (a, b) => a.recordIndex - b.recordIndex,
  );

  // 5. 제목과 연결 문장을 DB에 저장
  const { data, error } = await supabase.rpc("save_essay_ai_result", {
    p_essay_id: essayId,
    p_title: aiResult.title,
    p_bridges: sortedBridges,
  });

  if (error) {
    console.error("generateAndSaveEssay 저장 Error:", error);
    throw error;
  }
  if (!data) {
    throw new Error("AI 에세이 결과를 저장하지 못했습니다.");
  }

  return {
    essayId: data as string,
    title: aiResult.title,
    bridges: sortedBridges,
  };
}