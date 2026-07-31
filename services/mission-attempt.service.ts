import { supabase } from "@/lib/supabase";

export type MissionAttemptStatus =
  | "selected"
  | "started"
  | "completed"
  | "cancelled";

export type SelectMissionInput = {
  journeyId: string;
  missionId: string;
  placeId?: string | null;
};

export type MissionAttemptSummary = {
  id: string;
  journey_id: string;
  mission_id: string;
  place_id: string | null;
  status: MissionAttemptStatus;
  selected_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ActiveMissionAttempt = MissionAttemptSummary & {
  missions: {
    id: string;
    title: string;
    short_description: string;
    instructions: string;
    estimated_duration_min: number | null;
    estimated_cost: number;
    environment: "indoor" | "outdoor" | "any";
    companion_type: "alone" | "together" | "any";
    requires_place: boolean;
    required_items: string[];
  } | null;
  places: {
    id: string;
    name: string;
    category_name: string | null;
    address: string | null;
    road_address: string | null;
    latitude: number;
    longitude: number;
  } | null;
};

export type RecommendedMission = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  region: string | null;
  estimated_time: string | null;
  cost: string | null;
  source: "curated" | "ai";
  status: "pending" | "approved";
  created_at: string;
};

export type RecommendationFilterInput = {
  category?: string;
  region?: string;
  estimatedTime?: string;
  cost?: string;
  excludeMissionIds?: string[];
};

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

/**
 * Journey에서 미션을 선택하고
 * 생성된 mission_attempt ID를 반환한다.
 */
export async function selectMission({
  journeyId,
  missionId,
  placeId = null,
}: SelectMissionInput): Promise<string> {
  requireId(journeyId, "journeyId");
  requireId(missionId, "missionId");

  const { data, error } = await supabase.rpc("select_mission", {
    p_journey_id: journeyId,
    p_mission_id: missionId,
    p_place_id: placeId,
  });

  if (error) {
    console.error("selectMission Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error("미션 선택 정보를 생성하지 못했습니다.");
  }

  return String(data);
}

/**
 * 선택한 미션을 시작 상태로 변경한다.
 */
export async function startMission(
  missionAttemptId: string,
): Promise<string> {
  requireId(missionAttemptId, "missionAttemptId");

  const { data, error } = await supabase.rpc("start_mission", {
    p_mission_attempt_id: missionAttemptId,
  });

  if (error) {
    console.error("startMission Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error("미션을 시작하지 못했습니다.");
  }

  return String(data);
}

/**
 * 같은 Journey에서 같은 미션을 이미 선택하거나 시작했는지 조회한다.
 */
export async function getExistingMissionAttempt(
  journeyId: string,
  missionId: string,
): Promise<MissionAttemptSummary | null> {
  requireId(journeyId, "journeyId");
  requireId(missionId, "missionId");

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("mission_attempts")
    .select(
      `
        id,
        journey_id,
        mission_id,
        place_id,
        status,
        selected_at,
        started_at,
        completed_at,
        created_at
      `,
    )
    .eq("user_id", userId)
    .eq("journey_id", journeyId)
    .eq("mission_id", missionId)
    .in("status", ["selected", "started"])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getExistingMissionAttempt Error:", error);
    throw error;
  }

  return (data as MissionAttemptSummary | null) ?? null;
}

/**
 * 미션 선택과 시작을 한 번에 처리한다.
 */
export async function selectAndStartMission({
  journeyId,
  missionId,
  placeId = null,
}: SelectMissionInput): Promise<string> {
  const existingAttempt = await getExistingMissionAttempt(
    journeyId,
    missionId,
  );

  if (existingAttempt?.status === "started") {
    return existingAttempt.id;
  }

  if (existingAttempt?.status === "selected") {
    await startMission(existingAttempt.id);
    return existingAttempt.id;
  }

  const missionAttemptId = await selectMission({
    journeyId,
    missionId,
    placeId,
  });

  await startMission(missionAttemptId);

  return missionAttemptId;
}

/**
 * 선택하거나 시작한 미션을 취소한다.
 */
export async function cancelMission(
  missionAttemptId: string,
): Promise<string> {
  requireId(missionAttemptId, "missionAttemptId");

  const { data, error } = await supabase.rpc("cancel_mission", {
    p_mission_attempt_id: missionAttemptId,
  });

  if (error) {
    console.error("cancelMission Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error("미션을 취소하지 못했습니다.");
  }

  return String(data);
}

/**
 * 특정 Journey에서 선택, 시작, 완료된 미션 시도를 조회한다.
 */
export async function getJourneyMissionAttempts(
  journeyId: string,
): Promise<MissionAttemptSummary[]> {
  requireId(journeyId, "journeyId");

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("mission_attempts")
    .select(
      `
        id,
        journey_id,
        mission_id,
        place_id,
        status,
        selected_at,
        started_at,
        completed_at,
        created_at
      `,
    )
    .eq("user_id", userId)
    .eq("journey_id", journeyId)
    .in("status", ["selected", "started", "completed"])
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("getJourneyMissionAttempts Error:", error);
    throw error;
  }

  return (data ?? []) as MissionAttemptSummary[];
}

/**
 * 현재 Journey에서 선택하거나 시작한 미션을 모두 조회한다.
 */
export async function getActiveMissionAttempts(
  journeyId?: string,
): Promise<ActiveMissionAttempt[]> {
  const userId = await getCurrentUserId();

  let query = supabase
    .from("mission_attempts")
    .select(
      `
        id,
        journey_id,
        mission_id,
        place_id,
        status,
        selected_at,
        started_at,
        completed_at,
        created_at,
        missions (
          id,
          title,
          short_description,
          instructions,
          estimated_duration_min,
          estimated_cost,
          environment,
          companion_type,
          requires_place,
          required_items
        ),
        places (
          id,
          name,
          category_name,
          address,
          road_address,
          latitude,
          longitude
        )
      `,
    )
    .eq("user_id", userId)
    .in("status", ["selected", "started"])
    .order("created_at", {
      ascending: false,
    });

  if (journeyId !== undefined) {
    requireId(journeyId, "journeyId");
    query = query.eq("journey_id", journeyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getActiveMissionAttempts Error:", error);
    throw error;
  }

  return (data ?? []) as unknown as ActiveMissionAttempt[];
}

export async function getActiveMissionAttempt(
  journeyId?: string,
): Promise<ActiveMissionAttempt | null> {
  const attempts = await getActiveMissionAttempts(journeyId);
  return attempts[0] ?? null;
}

export async function getCompletedMissionCount(): Promise<number> {
  const userId = await getCurrentUserId();

  const { count, error } = await supabase
    .from("mission_attempts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("status", "completed");

  if (error) {
    console.error("getCompletedMissionCount Error:", error);
    throw error;
  }

  return count ?? 0;
}

export async function getMissionAttemptHistory(journeyId: string) {
  requireId(journeyId, "journeyId");

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("mission_attempts")
    .select(
      `
        id,
        journey_id,
        mission_id,
        place_id,
        status,
        selected_at,
        started_at,
        completed_at,
        created_at,
        missions (
          id,
          title,
          short_description,
          instructions
        ),
        places (
          id,
          name,
          category_name,
          address,
          road_address
        )
      `,
    )
    .eq("user_id", userId)
    .eq("journey_id", journeyId)
    .order("selected_at", {
      ascending: false,
    });

  if (error) {
    console.error("getMissionAttemptHistory Error:", error);
    throw error;
  }

  return data ?? [];
}

// =========================================================================
// 🌟 [신규 추가] AI 추천 미션 / 관리자 승인 & 반려 관련 서비스 함수들
// =========================================================================

/**
 * 1. 조건에 맞는 승인(approved) 미션을 최대 10개 조회한다.
 *    부족할 경우(K = 10 - N개), 백그라운드에서 AI 미션 생성을 요청한다.
 */
export async function getRecommendedMissions(
  filters: RecommendationFilterInput,
): Promise<RecommendedMission[]> {
  const { category, region, estimatedTime, cost, excludeMissionIds = [] } = filters;

  let query = supabase
    .from("missions")
    .select(
      `
        id,
        title,
        description,
        category,
        region,
        estimated_time,
        cost,
        source,
        status,
        created_at
      `,
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  if (category) query = query.eq("category", category);
  if (region) query = query.eq("region", region);
  if (estimatedTime) query = query.eq("estimated_time", estimatedTime);
  if (cost) query = query.eq("cost", cost);

  if (excludeMissionIds.length > 0) {
    query = query.not("id", "in", `(${excludeMissionIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getRecommendedMissions Error:", error);
    throw error;
  }

  const missions = (data ?? []) as RecommendedMission[];

  // 💡 승인된 미션이 10개보다 부족하면 백그라운드에서 AI 생성 트리거 (사용자는 대기하지 않음)
  if (missions.length < 10) {
    const requiredCount = 10 - missions.length;
    triggerAiMissionGeneration({
      category,
      region,
      estimatedTime,
      cost,
      requiredCount,
    }).catch((err) => {
      console.error("백그라운드 AI 미션 생성 트리거 실패:", err);
    });
  }

  return missions;
}

/**
 * 2. 백그라운드에서 AI에게 부족한 K개의 미션 생성을 요청하는 비동기 함수
 */
/**
 * 2. 백그라운드에서 AI에게 부족한 K개의 미션 생성을 요청하는 비동기 함수
 * (한국어 강제 적용 + 카카오 API 장소 정보 프롬프트 연동)
 */
async function triggerAiMissionGeneration(payload: {
  category?: string;
  region?: string;
  estimatedTime?: string;
  cost?: string;
  requiredCount: number;
  nearbyPlaces?: Array<{ name: string; category_name?: string }>; // 🌟 카카오 API로 찾은 실제 장소들
}) {
  // 최근 반려 사례와 사유를 가져와서 프롬프트 피드백에 활용
  const { data: rejectedCases } = await supabase
    .from("rejected_missions")
    .select("title, rejection_reason")
    .order("rejected_at", { ascending: false })
    .limit(5);

  // 🌟 카카오 API에서 넘어온 장소 목록이 있다면 프롬프트 텍스트로 가공
  const placesText = payload.nearbyPlaces && payload.nearbyPlaces.length > 0
    ? payload.nearbyPlaces.map((p) => `- ${p.name} (${p.category_name ?? "장소"})`).join("\n")
    : "주변 특정 장소 정보 없음 (어디서나 할 수 있는 미션으로 작성)";

  const promptMessage = `
당신은 30일간 삶의 의미와 소소한 행복을 찾아주는 챌린지 미션 생성 AI입니다.
아래 조건과 주변 장소 정보를 바탕으로 사용자가 바로 수행할 수 있는 맞춤형 미션을 정확히 ${payload.requiredCount}개 생성하세요.

[필수 기본 규칙]
- **언어 제약: 모든 미션 제목과 설명은 반드시 100% 자연스러운 한국어로만 작성하세요. (영어나 외국어 사용 금지)**
- **구체성: 단순히 "산책하기", "사진 찍기" 같은 모호하고 평범한 행동은 금지합니다. 유저가 흥미를 느낄 수 있는 구체적인 행동과 감정 기록 요소를 포함하세요.**

[요청 조건]
- 카테고리: ${payload.category ?? "상관없음"}
- 지역/위치: ${payload.region ?? "상관없음"}
- 예상 소요 시간: ${payload.estimatedTime ?? "상관없음"}
- 비용: ${payload.cost ?? "상관없음"}

[주변 실제 장소 목록 (카카오 API 제공)]
${placesText}
*(장소 정보가 제공된 경우, 가급적 위 장소 이름(예: 보노베리 등)을 미션 내용에 직접 활용하여 현실감 있는 미션을 만드세요.)*

[절대 생성하지 말아야 할 최근 반려 사례 및 이유]
${
  rejectedCases && rejectedCases.length > 0
    ? rejectedCases
        .map((rc, i) => `${i + 1}. 미션: "${rc.title}" / 반려사유: ${rc.rejection_reason}`)
        .join("\n")
    : "없음"
}

[반환 규칙]
- 설명이나 마크다운 없이 오직 JSON 객체만 반환하세요.
- 미션 개수는 정확히 ${payload.requiredCount}개여야 합니다.

반환 형식:
{
  "missions": [
    {
      "title": "미션 제목 (한국어)",
      "description": "사용자가 해야 할 구체적인 행동 설명 (한국어)",
      "category": "${payload.category ?? "기타"}",
      "region": "${payload.region ?? "전국"}",
      "estimatedTime": "${payload.estimatedTime ?? "30분 이내"}",
      "cost": "${payload.cost ?? "무료"}"
    }
  ]
}
`.trim();

  // Edge Function 호출
  const { data, error } = await supabase.functions.invoke("upstage-test", {
    body: { message: promptMessage },
  });

  if (error || !data?.answer) {
    console.error("AI 미션 생성 호출 실패:", error);
    return;
  }

  // AI 응답 파싱 및 pending 상태로 DB 저장
  try {
    const cleanedJson = data.answer
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");

    const parsed = JSON.parse(cleanedJson);

    if (Array.isArray(parsed.missions)) {
      const newMissions = parsed.missions.map((m: any) => ({
        title: m.title,
        description: m.description,
        category: m.category || payload.category || null,
        region: m.region || payload.region || null,
        estimated_time: m.estimatedTime || payload.estimatedTime || null,
        cost: m.cost || payload.cost || null,
        source: "ai",
        status: "pending", // 관리자 승인 전까지 노출되지 않음
      }));

      const { error: insertError } = await supabase
        .from("missions")
        .insert(newMissions);

      if (insertError) {
        console.error("AI 생성 미션 pending 저장 실패:", insertError);
      } else {
        console.log(`✅ AI가 생성한 pending 미션 ${newMissions.length}개 저장 완료`);
      }
    }
  } catch (parseErr) {
    console.error("AI 응답 JSON 파싱 실패:", parseErr);
  }
}

/**
 * 5. [관리자] 미션을 반려 처리한다.
 *    반려 사유(rejectionReason)를 가지고 rejected_missions에 기록 후,
 *    missions 테이블에서 해당 미션을 완전 삭제한다.
 */
export async function rejectMission(
  missionId: string,
  rejectionReason: string,
) {
  requireId(missionId, "missionId");

  if (!rejectionReason.trim()) {
    throw new Error("반려 사유는 필수 입력 항목입니다.");
  }

  // 1) 원본 미션 정보 조회
  const { data: mission, error: selectError } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (selectError || !mission) {
    throw new Error("반려할 미션을 찾을 수 없습니다.");
  }

  // 2) rejected_missions 테이블에 반려 사유와 함께 백업 저장
  const { error: insertError } = await supabase
    .from("rejected_missions")
    .insert({
      original_mission_id: mission.id,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      region: mission.region,
      estimated_time: mission.estimated_time,
      cost: mission.cost,
      rejection_reason: rejectionReason.trim(),
    });

  if (insertError) {
    console.error("rejected_missions 저장 실패:", insertError);
    throw insertError;
  }

  // 3) missions 테이블에서 해당 미션 삭제
  const { error: deleteError } = await supabase
    .from("missions")
    .delete()
    .eq("id", missionId);

  if (deleteError) {
    console.error("missions 테이블 미션 삭제 실패:", deleteError);
    throw deleteError;
  }

  return { success: true, rejectedMissionId: missionId };
} 