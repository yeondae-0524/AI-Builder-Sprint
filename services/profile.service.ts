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
  selected_title_id?: string | null;
  interests?: string[];
};

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user.id;
}

function normalizeNullableText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeInterests(
  interests: string[] | null | undefined,
): string[] {
  if (!Array.isArray(interests)) {
    return [];
  }

  return Array.from(
    new Set(
      interests
        .map((interest) => interest.trim())
        .filter((interest) => interest.length > 0),
    ),
  );
}

function normalizeProfile(
  profile: Omit<Profile, "interests"> & {
    interests: string[] | null;
  },
): Profile {
  return {
    ...profile,
    interests: normalizeInterests(profile.interests),
  };
}

/**
 * 현재 로그인한 사용자의 프로필을 조회한다.
 */
export async function getMyProfile(): Promise<Profile> {
  const userId = await getCurrentUserId();

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
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getMyProfile Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error("프로필을 찾을 수 없습니다.");
  }

  return normalizeProfile(
    data as Omit<Profile, "interests"> & {
      interests: string[] | null;
    },
  );
}

/**
 * 현재 로그인한 사용자의 프로필을 수정한다.
 */
export async function updateMyProfile(
  input: UpdateProfileInput,
): Promise<Profile> {
  const userId = await getCurrentUserId();

  if (
    input.nickname !== undefined &&
    !input.nickname.trim()
  ) {
    throw new Error("닉네임을 입력해주세요.");
  }

  const updateData: {
    nickname?: string;
    bio?: string | null;
    avatar_url?: string | null;
    activity_region?: string | null;
    selected_title_id?: string | null;
    interests?: string[];
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (input.nickname !== undefined) {
    updateData.nickname = input.nickname.trim();
  }

  if (input.bio !== undefined) {
    updateData.bio =
      normalizeNullableText(input.bio) ?? null;
  }

  if (input.avatar_url !== undefined) {
    updateData.avatar_url =
      normalizeNullableText(input.avatar_url) ?? null;
  }

  if (input.activity_region !== undefined) {
    updateData.activity_region =
      normalizeNullableText(input.activity_region) ??
      null;
  }

  if (input.selected_title_id !== undefined) {
    updateData.selected_title_id =
      normalizeNullableText(
        input.selected_title_id,
      ) ?? null;
  }

  if (input.interests !== undefined) {
    updateData.interests = normalizeInterests(
      input.interests,
    );
  }

  const { data, error } = await supabase
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
    .maybeSingle();

  if (error) {
    console.error("updateMyProfile Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      "프로필을 찾을 수 없거나 수정 권한이 없습니다.",
    );
  }

  return normalizeProfile(
    data as Omit<Profile, "interests"> & {
      interests: string[] | null;
    },
  );
}