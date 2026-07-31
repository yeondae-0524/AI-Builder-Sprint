import { supabase } from "./supabase";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type SupabaseResult<T> = {
  data: T;
  error: unknown;
};

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function isJwtIssuedAtFutureError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseErrorLike;
  const code = String(candidate.code ?? "");
  const message = String(candidate.message ?? "").toLowerCase();

  return (
    message.includes("jwt issued at future") ||
    (code === "PGRST303" && message.includes("jwt"))
  );
}

export async function refreshSupabaseSession() {
  // 서버와 단말기의 시계 차이가 아주 작을 때 같은 오류가 즉시 반복되는 것을 방지합니다.
  await sleep(1200);

  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error(
      "로그인 세션을 갱신하지 못했습니다. 로그아웃 후 다시 로그인해주세요.",
    );
  }

  return data.session;
}

/** 내부에서 error를 throw하는 서비스 함수용 */
export async function withJwtRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isJwtIssuedAtFutureError(error)) {
      throw error;
    }

    await refreshSupabaseSession();
    return operation();
  }
}

/** Supabase 쿼리처럼 { data, error }를 반환하는 함수용 */
export async function withSupabaseResultJwtRetry<T>(
  operation: () => PromiseLike<SupabaseResult<T>>,
): Promise<T> {
  let result = await operation();

  if (result.error && isJwtIssuedAtFutureError(result.error)) {
    await refreshSupabaseSession();
    result = await operation();
  }

  if (result.error) {
    throw result.error;
  }

  return result.data;
}