import { supabase } from "@/lib/supabase";
import { addBadgePoints } from "./badge.service"; // 👈 방금 만든 뱃지 서비스 불러오기!

export interface CreateRecordDTO {
  userId: string;
  journeyId: string;
  missionId: string; // Edge Function이 만들어준 진짜 DB UUID
  content: string;   // 사용자가 작성한 에세이/글
  imageUrl?: string; // 스토리지에 올린 사진 URL (선택)
}

/**
 * [미션 기록 저장 및 뱃지 포인트 적립]
 */
export const createRecord = async ({
  userId,
  journeyId,
  missionId,
  content,
  imageUrl,
}: CreateRecordDTO) => {
  try {
    // 1. 사용자의 기록을 'records' 테이블에 저장
    const newRecord = {
      user_id: userId,
      journey_id: journeyId,
      mission_id: missionId,
      content,
      image_url: imageUrl,
    };

    const { data: recordData, error: recordError } = await supabase
      .from("records")
      .insert([newRecord])
      .select()
      .single();

    if (recordError) throw recordError;

    // 2. 방금 완료한 미션의 DB 데이터를 조회해서 어떤 뱃지가 걸려있는지(badge_ids) 확인
    const { data: missionData, error: missionError } = await supabase
      .from("missions")
      .select("badge_ids")
      .eq("id", missionId)
      .single();

    if (missionError) throw missionError;

    // 3. 뱃지 포인트 올려주기 실행! 🚀
    if (missionData.badge_ids && missionData.badge_ids.length > 0) {
      await addBadgePoints(userId, missionData.badge_ids);
    }

    return { success: true, data: recordData };
  } catch (error) {
    console.error("createRecord Error:", error);
    return { success: false, error };
  }
};