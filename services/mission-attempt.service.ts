import { supabase } from "@/lib/supabase";

export type SelectMissionInput = {
  journeyId: string;
  missionId: string;
  placeId?: string | null;
};

/**
 * Journey에서 미션을 선택하고
 * 생성된 mission_attempt ID를 반환한다.
 */
export async function selectMission({
  journeyId,
  missionId,
  placeId = null,
}: SelectMissionInput): Promise<string> {
  if (!journeyId.trim()) {
    throw new Error("journeyId가 필요합니다.");
  }

  if (!missionId.trim()) {
    throw new Error("missionId가 필요합니다.");
  }

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

  return data as string;
}

/**
 * 선택한 미션을 시작 상태로 변경한다.
 */
export async function startMission(
  missionAttemptId: string,
): Promise<string> {
  if (!missionAttemptId.trim()) {
    throw new Error(
      "missionAttemptId가 필요합니다.",
    );
  }

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

  return data as string;
}

/**
 * 선택하거나 시작한 미션을 취소한다.
 */
export async function cancelMission(
  missionAttemptId: string,
): Promise<string> {
  if (!missionAttemptId.trim()) {
    throw new Error(
      "missionAttemptId가 필요합니다.",
    );
  }

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

  return data as string;
}

/**
 * 현재 선택했거나 시작한 미션을 조회한다.
 */
export async function getActiveMissionAttempt() {
  const { data, error } = await supabase
    .from("mission_attempts")
    .select(`
      id,
      journey_id,
      mission_id,
      place_id,
      status,
      selected_at,
      started_at,
      completed_at,
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
    `)
    .in("status", ["selected", "started"])
    .maybeSingle();

  if (error) {
    console.error(
      "getActiveMissionAttempt Error:",
      error,
    );
    throw error;
  }

  return data;
}

/**
 * 특정 Journey에서 선택했던 미션 내역을 조회한다.
 */
export async function getMissionAttemptHistory(
  journeyId: string,
) {
  if (!journeyId.trim()) {
    throw new Error("journeyId가 필요합니다.");
  }

  const { data, error } = await supabase
    .from("mission_attempts")
    .select(`
      id,
      journey_id,
      mission_id,
      place_id,
      status,
      selected_at,
      started_at,
      completed_at,
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
    `)
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