import { supabase } from "@/lib/supabase";

// 🏆 티어 계산기 (포인트에 따라 티어 반환)
const calculateTier = (points: number): string => {
  if (points >= 30) return "PRISM";
  if (points >= 15) return "GOLD";
  if (points >= 7) return "SILVER";
  if (points >= 3) return "BRONZE";
  return "LOCKED";
};

/**
 * [뱃지 포인트 추가 함수]
 * 미션에 연결된 뱃지 ID 배열을 받아 각각 포인트를 +1 하고 티어를 업데이트합니다.
 */
export const addBadgePoints = async (userId: string, badgeIds: string[]) => {
  try {
    if (!badgeIds || badgeIds.length === 0) return { success: true };

    for (const badgeId of badgeIds) {
      // 1. 유저의 현재 뱃지 상태 조회
      const { data: userBadge } = await supabase
        .from("user_badges")
        .select("points")
        .eq("user_id", userId)
        .eq("badge_id", badgeId)
        .maybeSingle();

      const currentPoints = userBadge ? userBadge.points : 0;
      const newPoints = currentPoints + 1; // 포인트 1 증가
      const newTier = calculateTier(newPoints); // 새로운 티어 계산

      // 2. 포인트와 티어 DB에 덮어쓰기(upsert)
      const { error } = await supabase
        .from("user_badges")
        .upsert({
          user_id: userId,
          badge_id: badgeId,
          points: newPoints,
          tier: newTier,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id, badge_id" });

      if (error) {
        console.error(`뱃지 업데이트 에러 (${badgeId}):`, error.message);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("addBadgePoints Error:", error);
    return { success: false, error };
  }
};

/**
 * [내 뱃지 보관함 조회 함수]
 * 프론트엔드에서 뱃지 화면을 그릴 때 사용합니다.
 */
export const getMyBadges = async (userId: string) => {
  try {
    // 뱃지 마스터 테이블과 유저 뱃지 테이블을 조인해서 가져옴
    const { data, error } = await supabase
      .from("badges")
      .select(`
        id,
        name,
        icon,
        description,
        user_badges ( points, tier )
      `);

    if (error) throw error;

    // 프론트엔드가 쓰기 편하게 데이터 가공
    const formattedBadges = data.map((badge: any) => {
      const userBadgeInfo = badge.user_badges?.find((ub: any) => ub) || { points: 0, tier: "LOCKED" };
      return {
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        points: userBadgeInfo.points,
        tier: userBadgeInfo.tier,
      };
    });

    return { success: true, data: formattedBadges };
  } catch (error) {
    console.error("getMyBadges Error:", error);
    return { success: false, error };
  }
};