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

  const { data, error } = await supabase.rpc(
    "select_mission",
    {
      p_journey_id: journeyId,
      p_mission_id: missionId,
      p_place_id: placeId,
    },
  );

  if (error) {
    console.error("selectMission Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      "미션 선택 정보를 생성하지 못했습니다.",
    );
  }

  return String(data);
}

/**
 * 선택한 미션을 시작 상태로 변경한다.
 */
export async function startMission(
  missionAttemptId: string,
): Promise<string> {
  requireId(
    missionAttemptId,
    "missionAttemptId",
  );

  const { data, error } = await supabase.rpc(
    "start_mission",
    {
      p_mission_attempt_id: missionAttemptId,
    },
  );

  if (error) {
    console.error("startMission Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      "미션을 시작하지 못했습니다.",
    );
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
    console.error(
      "getExistingMissionAttempt Error:",
      error,
    );
    throw error;
  }

  return (data as MissionAttemptSummary | null) ?? null;
}

/**
 * 미션 선택과 시작을 한 번에 처리한다.
 *
 * 빠르게 여러 번 눌러도 같은 Journey의 같은 미션에 대해
 * 이미 선택 또는 시작된 시도가 있으면 기존 시도를 재사용한다.
 */
export async function selectAndStartMission({
  journeyId,
  missionId,
  placeId = null,
}: SelectMissionInput): Promise<string> {
  const existingAttempt =
    await getExistingMissionAttempt(
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
  requireId(
    missionAttemptId,
    "missionAttemptId",
  );

  const { data, error } = await supabase.rpc(
    "cancel_mission",
    {
      p_mission_attempt_id: missionAttemptId,
    },
  );

  if (error) {
    console.error("cancelMission Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      "미션을 취소하지 못했습니다.",
    );
  }

  return String(data);
}

/**
 * 특정 Journey에서 선택, 시작, 완료된 미션 시도를 조회한다.
 * 홈 화면의 진행 중 미션과 완료 미션 상태를 복원할 때 사용한다.
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
    .in("status", [
      "selected",
      "started",
      "completed",
    ])
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "getJourneyMissionAttempts Error:",
      error,
    );
    throw error;
  }

  return (data ?? []) as MissionAttemptSummary[];
}

/**
 * 현재 Journey에서 선택하거나 시작한 미션을 모두 조회한다.
 *
 * 여러 미션을 동시에 진행할 수 있으므로 배열을 반환한다.
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
    console.error(
      "getActiveMissionAttempts Error:",
      error,
    );
    throw error;
  }

  return (data ?? []) as unknown as ActiveMissionAttempt[];
}

/**
 * 기존 함수 호출 방식과 호환되도록 journeyId는 선택값이다.
 * 전달하면 해당 Journey에서, 생략하면 사용자의 전체 Journey에서
 * 가장 최근의 진행 중 미션 하나를 반환한다.
 */
export async function getActiveMissionAttempt(
  journeyId?: string,
): Promise<ActiveMissionAttempt | null> {
  const attempts =
    await getActiveMissionAttempts(journeyId);

  return attempts[0] ?? null;
}

/**
 * 현재 사용자가 지금까지 완료한 미션 수를 조회한다.
 * missions.unlock_count에 따른 미션 잠금 해제에 사용한다.
 */
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
    console.error(
      "getCompletedMissionCount Error:",
      error,
    );
    throw error;
  }

  return count ?? 0;
}

/**
 * 특정 Journey에서 선택했던 미션 내역을 조회한다.
 */
export async function getMissionAttemptHistory(
  journeyId: string,
) {
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
    console.error(
      "getMissionAttemptHistory Error:",
      error,
    );
    throw error;
  }

  return data ?? [];
}