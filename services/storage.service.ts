import { supabase } from "@/lib/supabase"; // 본인의 supabase 클라이언트 경로

/**
 * [사진 업로드 함수]
 * @param file - HTML input에서 선택된 File 객체 또는 React Native의 image 데이터
 * @param userId - 업로드하는 사용자 ID (파일명 중복 방지용)
 * @returns { success: boolean, imageUrl?: string, error?: any }
 */
export const uploadMissionImage = async (file: File, userId: string) => {
  try {
    // 1. 파일 이름 중복을 방지하기 위해 '사용자ID_시간스탬프_원래이름' 형태로 생성
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `missions/${fileName}`;

    // 2. Supabase Storage 'records' 버킷에 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("records")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false, // 동일 파일명 덮어쓰기 여부
      });

    if (uploadError) throw uploadError;

    // 3. 업로드된 사진의 Public URL(인터넷 공개 주소) 가져오기
    const { data: urlData } = supabase.storage
      .from("records")
      .getPublicUrl(filePath);

    return {
      success: true,
      imageUrl: urlData.publicUrl, // 이 URL을 1단계 createRecord의 imageUrl에 전달하면 됩니다!
    };
  } catch (error) {
    console.error("uploadMissionImage Error:", error);
    return { success: false, error };
  }
};