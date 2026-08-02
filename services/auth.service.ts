import type {
  AuthChangeEvent,
  Session,
} from "@supabase/supabase-js";
import { Share } from "react-native";
import { supabase } from "../lib/supabase";

export type SignUpInput = {
  email: string;
  password: string;
  nickname: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

/**
 * 이메일 회원가입
 */
export async function signUp({
  email,
  password,
  nickname,
}: SignUpInput) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedNickname = nickname.trim();

  if (!normalizedEmail) {
    throw new Error("이메일을 입력해주세요.");
  }

  if (!normalizedNickname) {
    throw new Error("닉네임을 입력해주세요.");
  }

  if (password.length < 6) {
    throw new Error("비밀번호는 6자 이상이어야 합니다.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        nickname: normalizedNickname,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 이메일 로그인
 */
export async function signIn({
  email,
  password,
}: SignInInput) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 현재 기기에서 로그아웃
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error) {
    throw error;
  }
}

/**
 * 현재 로그인된 사용자 조회
 */
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

/**
 * 현재 로그인 세션 조회
 */
export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

/**
 * 로그인·로그아웃 상태 변경 감지
 */
export function onAuthStateChange(
  callback: (
    event: AuthChangeEvent,
    session: Session | null,
  ) => void,
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return subscription;
}

/**
 * ----------------------------------------------------
 * 🌿 새로 추가된 기능 (내보내기 / 비밀번호 / 회원탈퇴)
 * ----------------------------------------------------
 */

/**
 * 1. 기록 데이터 내보내기 (JSON 백업 추출 및 모바일 공유)
 */
export async function exportMyRecords(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  const { data: records, error: recordsError } = await supabase
    .from("records")
    .select("*")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false });

  if (recordsError) {
    throw new Error("기록 데이터를 가져오지 못했습니다.");
  }

  if (!records || records.length === 0) {
    throw new Error("내보낼 기록 데이터가 없습니다.");
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    userEmail: user.email,
    recordCount: records.length,
    records,
  };

  await Share.share({
    title: "BEGIN AGAIN 기록 데이터 백업",
    message: JSON.stringify(exportData, null, 2),
  });
}

/**
 * 2. 비밀번호 직접 변경
 */
export async function updatePassword(newPassword: string): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}

/**
 * 3. 비밀번호 재설정 이메일 받기
 */
export async function requestPasswordReset(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    throw new Error("사용자 이메일을 확인할 수 없습니다.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email);

  if (error) {
    throw error;
  }
}

/**
 * 4. 회원 탈퇴
 */
export async function deleteAccount(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }

  const { error: profileDeleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", user.id);

  if (profileDeleteError) {
    console.warn("프로필 삭제 권한 경고:", profileDeleteError.message);
  }

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "global",
  });

  if (signOutError) {
    throw signOutError;
  }
}