import { supabase } from "@/lib/supabase";

type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

type UploadMissionImageParams = {
  imageUri: string;
  recordId: string;
  mimeType?: ImageMimeType;
};

export async function uploadMissionImage({
  imageUri,
  recordId,
  mimeType = "image/jpeg",
}: UploadMissionImageParams) {
  let uploadedPath: string | null = null;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }

    if (!recordId) {
      throw new Error("recordId가 필요합니다.");
    }

    const response = await fetch(imageUri);

    if (!response.ok) {
      throw new Error("이미지 파일을 불러오지 못했습니다.");
    }

    const imageData = await response.arrayBuffer();

    const extensionMap: Record<ImageMimeType, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = extensionMap[mimeType];

    const randomValue = Math.random()
      .toString(36)
      .slice(2);

    const fileName =
      `${Date.now()}-${randomValue}.${extension}`;

    // Storage 정책과 맞는 경로
    // 사용자ID/기록ID/파일명
    const filePath =
      `${user.id}/${recordId}/${fileName}`;

    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from("record-photos")
        .upload(filePath, imageData, {
          cacheControl: "3600",
          contentType: mimeType,
          upsert: false,
        });

    if (uploadError) {
      throw uploadError;
    }

    uploadedPath = uploadData.path;

    const { error: photoError } = await supabase
      .from("record_photos")
      .insert({
        record_id: recordId,
        storage_path: uploadData.path,
        sort_order: 0,
        is_cover: true,
      });

    if (photoError) {
      await supabase.storage
        .from("record-photos")
        .remove([uploadData.path]);

      uploadedPath = null;
      throw photoError;
    }

    return {
      success: true,
      storagePath: uploadData.path,
    };
  } catch (error) {
    console.error(
      "uploadMissionImage Error:",
      error,
    );

    if (uploadedPath) {
      await supabase.storage
        .from("record-photos")
        .remove([uploadedPath]);
    }

    return {
      success: false,
      error,
    };
  }
}