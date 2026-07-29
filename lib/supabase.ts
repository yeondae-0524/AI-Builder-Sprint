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

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);