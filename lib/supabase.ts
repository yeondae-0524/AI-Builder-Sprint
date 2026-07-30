import "expo-sqlite/localStorage/install";
import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase 환경변수가 설정되지 않았습니다.",
  );
}

/**
 * 앱이나 브라우저에서는 localStorage를 사용하고,
 * Vercel 정적 렌더링(Node.js) 중에는 사용하지 않는다.
 */
const storage =
  typeof globalThis.localStorage !== "undefined"
    ? globalThis.localStorage
    : undefined;

const canPersistSession = Boolean(storage);

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      ...(storage ? { storage } : {}),
      autoRefreshToken: canPersistSession,
      persistSession: canPersistSession,
      detectSessionInUrl: false,
    },
  },
);