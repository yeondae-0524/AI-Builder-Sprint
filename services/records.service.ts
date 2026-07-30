import { supabase } from "@/lib/supabase"; // 본인의 supabase 클라이언트 경로에 맞게 수정

// 1. 기록 생성에 필요한 입력 데이터 타입
export interface CreateRecordDTO {
  journeyId: string;        // 현재 진행 중인 여정 ID
  userId: string;           // 사용자 ID
  dayNumber: number;        // 며칠 차인지 (예: 1일 차)
  missionTitle: string;     // 수행한 미션 제목 (예: '조용한 카페에서 30분 독서')
  content: string;          // 감상 및 메모 내용
  imageUrl?: string;        // 사진 URL (선택)
  sentiment?: string;       // 감정 상태 (예: '평온함', '쓸쓸함', '기쁨')
  isPrivate?: boolean;      // 나만 보기 여부 (기본값: false)
  locationName?: string;    // 로컬 장소명 (선택, 예: '골목길 책방')
}

/**
 * [함수 1] createRecord
 * 미션 수행 기록을 DB에 저장합니다. (하루에 여러 번 호출 가능!)
 */
export const createRecord = async (dto: CreateRecordDTO) => {
  try {
    const newRecord = {
      journey_id: dto.journeyId,
      user_id: dto.userId,
      day_number: dto.dayNumber,
      mission_title: dto.missionTitle,
      content: dto.content,
      image_url: dto.imageUrl || null,
      sentiment: dto.sentiment || "평온",
      is_private: dto.isPrivate ?? false,
      location_name: dto.locationName || null,
    };

    const { data, error } = await supabase
      .from("records")
      .insert([newRecord])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("createRecord Error:", error);
    return { success: false, error };
  }
};

/**
 * [함수 2] getTodayRecords
 * 오늘(특정 dayNumber) 작성한 미션 기록들을 전부 가져옵니다. (하루에 여러 개일 수 있음)
 */
export const getTodayRecords = async (journeyId: string, dayNumber: number) => {
  try {
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("journey_id", journeyId)
      .eq("day_number", dayNumber)
      .order("created_at", { ascending: true }); // 먼저 작성한 순서대로 정렬

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("getTodayRecords Error:", error);
    return { success: false, error };
  }
};

/**
 * [함수 3] getJourneyRecords
 * 30일(전체 여정) 동안 쌓인 모든 미션 기록을 가져옵니다. (에세이 AI 생성 시 사용)
 */
export const getJourneyRecords = async (journeyId: string) => {
  try {
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("journey_id", journeyId)
      .order("day_number", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("getJourneyRecords Error:", error);
    return { success: false, error };
  }
};

/**
 * [함수 4] deleteRecord
 * 실수로 올린 기록을 삭제합니다.
 */
export const deleteRecord = async (recordId: string, userId: string) => {
  try {
    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", recordId)
      .eq("user_id", userId); // 본인 기록만 삭제 가능하도록 안전장치

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("deleteRecord Error:", error);
    return { success: false, error };
  }
};