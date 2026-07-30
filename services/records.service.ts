import { supabase } from "@/lib/supabase";

export type RecordVisibility =
  | "private"
  | "anonymous"
  | "nickname";

export interface CreateRecordDTO {
  missionAttemptId: string;
  emotion: string;
  content: string;
  visibility?: RecordVisibility;
  placeId?: string | null;
}

/**
 * 기록 생성과 함께 다음 작업을 처리한다.
 *
 * - records 생성
 * - mission_attempts 완료 처리
 * - Journey 목표 달성 시 completed 처리
 */
export async function createRecord({
  missionAttemptId,
  emotion,
  content,
  visibility = "private",
  placeId = null,
}: CreateRecordDTO) {
  try {
    if (!missionAttemptId) {
      throw new Error("missionAttemptId가 필요합니다.");
    }

    if (!emotion.trim()) {
      throw new Error("감정을 선택해야 합니다.");
    }

    if (!content.trim()) {
      throw new Error("기록 내용을 입력해야 합니다.");
    }

    const { data: recordId, error } = await supabase.rpc(
      "complete_mission_with_record",
      {
        p_mission_attempt_id: missionAttemptId,
        p_emotion: emotion.trim(),
        p_content: content.trim(),
        p_visibility: visibility,
        p_place_id: placeId,
      },
    );

    if (error) {
      throw error;
    }

    return {
      success: true as const,
      recordId: recordId as string,
    };
  } catch (error) {
    console.error("createRecord Error:", error);

    return {
      success: false as const,
      error,
    };
  }
}