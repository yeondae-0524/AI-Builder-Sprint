import { supabase } from "../lib/supabase";
import {
  isJwtIssuedAtFutureError,
  refreshSupabaseSession,
} from "../lib/supabase-auth-retry";

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

async function getCurrentUser() {
  let {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && isJwtIssuedAtFutureError(error)) {
    await refreshSupabaseSession();

    const retryResult = await supabase.auth.getUser();
    user = retryResult.data.user;
    error = retryResult.error;
  }

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
}

async function readProfile(userId: string) {
  return supabase
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
    .eq("id", userId)
    .single();
}

/** 현재 사용자의 프로필 조회 */
export async function getMyProfile(): Promise<Profile> {
  let user = await getCurrentUser();
  let result = await readProfile(user.id);

  if (result.error && isJwtIssuedAtFutureError(result.error)) {
    await refreshSupabaseSession();
    user = await getCurrentUser();
    result = await readProfile(user.id);
  }

  if (result.error) {
    throw result.error;
  }

  return result.data as Profile;
}

/** 현재 사용자의 프로필 수정 */
export async function updateMyProfile(
  input: UpdateProfileInput,
): Promise<Profile> {
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

  let user = await getCurrentUser();

  const updateOnce = (userId: string) =>
    supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
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

  let result = await updateOnce(user.id);

  if (result.error && isJwtIssuedAtFutureError(result.error)) {
    await refreshSupabaseSession();
    user = await getCurrentUser();
    result = await updateOnce(user.id);
  }

  if (result.error) {
    throw result.error;
  }

  return result.data as Profile;
}