import { supabase } from "../lib/supabase";

export type MissionCategory = {
  id: string;
  name: string;
  icon_name: string | null;
};

export type Mission = {
  id: string;
  category_id: string;
  title: string;
  short_description: string;
  instructions: string;
  recommendation_reason: string | null;
  estimated_duration_min: number | null;
  estimated_cost: number;
  environment: "indoor" | "outdoor" | "any";
  companion_type: "alone" | "together" | "any";
  requires_place: boolean;
  required_items: string[];
  unlock_count: number;
  is_active: boolean;
  created_at: string;
  category: MissionCategory | null;
};

const MISSION_SELECT = `
  id,
  category_id,
  title,
  short_description,
  instructions,
  recommendation_reason,
  estimated_duration_min,
  estimated_cost,
  environment,
  companion_type,
  requires_place,
  required_items,
  unlock_count,
  is_active,
  created_at,
  category:mission_categories (
    id,
    name,
    icon_name
  )
`;

/**
 * 사용자가 현재 볼 수 있는 추천 미션을 조회한다.
 *
 * 첫 사용자는 completedMissionCount에 0을 전달하면
 * unlock_count가 0인 미션만 조회된다.
 */
export async function getRecommendedMissions(
  limit = 5,
  completedMissionCount = 0,
): Promise<Mission[]> {
  const safeLimit = Math.min(
    Math.max(limit, 1),
    20,
  );

  const safeCompletedCount = Math.max(
    completedMissionCount,
    0,
  );

  const { data, error } = await supabase
    .from("missions")
    .select(MISSION_SELECT)
    .eq("is_active", true)
    .lte("unlock_count", safeCompletedCount)
    .order("unlock_count", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as Mission[];
}

/**
 * 미션 ID로 미션 상세 정보를 조회한다.
 */
export async function getMissionById(
  missionId: string,
): Promise<Mission> {
  if (!missionId.trim()) {
    throw new Error("미션 ID가 필요합니다.");
  }

  const { data, error } = await supabase
    .from("missions")
    .select(MISSION_SELECT)
    .eq("id", missionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("미션을 찾을 수 없습니다.");
  }

  return data as unknown as Mission;
}