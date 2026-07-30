import { supabase } from "@/lib/supabase"; // 본인 프로젝트 경로에 맞게 수정

export type JourneyStatus = "active" | "completed" | "cancelled";
export type DurationDays = 7 | 14 | 30;

// 선택 가능한 카테고리 종류
export type CategoryType =
  | "음식"
  | "카페 및 디저트"
  | "산책"
  | "배움"
  | "감상"
  | "활동"
  | "휴식"
  | "기타";

export interface CreateJourneyDTO {
  userId: string;
  durationDays: DurationDays;
  category: CategoryType; // 👈 여정 생성 시 카테고리 필수 선택!
  startDate?: Date;
}

/**
 * [함수 1] createJourney
 * 선택한 기간과 카테고리로 새로운 여정을 시작합니다.
 */
export const createJourney = async ({
  userId,
  durationDays,
  category,
  startDate = new Date(),
}: CreateJourneyDTO) => {
  try {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (durationDays - 1));

    const startDateStr = start.toISOString().split("T")[0];
    const endDateStr = end.toISOString().split("T")[0];

    const targetRecordCountMap: Record<DurationDays, number> = {
      7: 4,
      14: 7,
      30: 15,
    };

    const newJourney = {
      user_id: userId,
      title: `${category}와 함께하는 ${durationDays}일의 여정`, // 예: "카페 및 디저트와 함께하는 7일의 여정"
      duration_days: durationDays,
      category: category, // 👈 카테고리 저장
      target_record_count: targetRecordCountMap[durationDays],
      start_date: startDateStr,
      end_date: endDateStr,
      status: "active" as JourneyStatus,
    };

    const { data, error } = await supabase
      .from("journeys")
      .insert([newJourney])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("createJourney Error:", error);
    return { success: false, error };
  }
};

/**
 * [함수 2] getActiveJourney
 * 현재 진행 중인 여정(카테고리 정보 포함)을 조회합니다.
 */
export const getActiveJourney = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("journeys")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("getActiveJourney Error:", error);
    return { success: false, error };
  }
};

/**
 * [함수 3] getMyJourneys
 */
export const getMyJourneys = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("journeys")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("getMyJourneys Error:", error);
    return { success: false, error };
  }
};

/**
 * [함수 4] completeJourney
 */
export const completeJourney = async (journeyId: string) => {
  try {
    const { data, error } = await supabase
      .from("journeys")
      .update({ status: "completed" })
      .eq("id", journeyId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("completeJourney Error:", error);
    return { success: false, error };
  }
};