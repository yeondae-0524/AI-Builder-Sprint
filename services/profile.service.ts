import { supabase } from "../lib/supabase";

export type Profile = {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  activity_region: string | null;
  selected_title_id: string | null;
  interests: string[];
  created_at: string;
  updated_at: string;
};

export type UpdateProfileInput = {
  nickname?: string;
  bio?: string | null;
  avatar_url?: string | null;
  activity_region?: string | null;
  interests?: string[];
};

/**
 * 현재 사용자의 프로필 조회
 */
export async function getMyProfile(): Promise<Profile> {
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

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
        id,
        nickname,
        bio,
        avatar_url,
        activity_region,
        selected_title_id,
        interests,
        created_at,
        updated_at
      `,
    )
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

/**
 * 현재 사용자의 프로필 수정
 */
export async function updateMyProfile(
  input: UpdateProfileInput,
): Promise<Profile> {
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

  if (
    input.nickname !== undefined &&
    !input.nickname.trim()
  ) {
    throw new Error("닉네임을 입력해주세요.");
  }

  const updateData: UpdateProfileInput = {
    ...input,
  };

  if (input.nickname !== undefined) {
    updateData.nickname = input.nickname.trim();
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)
    .select(
      `
        id,
        nickname,
        bio,
        avatar_url,
        activity_region,
        selected_title_id,
        interests,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}