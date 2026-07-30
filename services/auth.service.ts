import type {
  AuthChangeEvent,
  Session,
} from "@supabase/supabase-js";

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

  const { data, error } =
    await supabase.auth.signUp({
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

  const { data, error } =
    await supabase.auth.signInWithPassword({
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
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    },
  );

  return subscription;
}