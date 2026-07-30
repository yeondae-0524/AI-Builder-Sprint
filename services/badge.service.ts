import { supabase } from "@/lib/supabase";

// 티어 판정 기준
const calculateTier = (points: number): string => {
  if (points >= 30) return "PRISM";
  if (points >= 15) return "GOLD";
  if (points >= 7) return "SILVER";
  if (points >= 3) return "BRONZE";
  return "LOCKED";
};

/**
 * 미션 완료 시 연관된 뱃지들의 포인트를 1씩 올리고 티어를 업데이트합니다.
 * @param userId 사용자 ID
 * @param badgeIds 미션에 연결된 뱃지 ID 목록 (예: ['badge_walk', 'badge_animal'])
 */
export const addBadgePoints = async (userId: string, badgeIds: string[]) => {
  try {
    for (const badgeId of badgeIds) {
      // 1. 현재 사용자의 해당 뱃지 정보 조회
      const { data: userBadge } = await supabase
        .from("user_badges")
        .select("*")
        .eq("user_id", userId)
        .eq("badge_id", badgeId)
        .maybeSingle();

      const currentPoints = userBadge ? userBadge.points : 0;
      const newPoints = currentPoints + 1; // 포인트 +1
      const newTier = calculateTier(newPoints); // 새로운 티어 계산

      // 2. DB 업데이트 (없으면 신규 생성)
      const { error } = await supabase
        .from("user_badges")
        .upsert({
          user_id: userId,
          badge_id: badgeId,
          points: newPoints,
          tier: newTier,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id, badge_id" });

      if (error) console.error(`Badge update error (${badgeId}):`, error);
    }

    return { success: true };
  } catch (error) {
    console.error("addBadgePoints Error:", error);
    return { success: false, error };
  }
}; 