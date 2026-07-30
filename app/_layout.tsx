import type { Session } from "@supabase/supabase-js";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [session, setSession] =
    useState<Session | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 앱을 켰을 때 저장된 로그인 정보 확인
    const loadSession = async () => {
      const {
        data: { session: savedSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(savedSession);
      setIsLoading(false);
    };

    loadSession();

    // 로그인 또는 로그아웃이 발생하면 자동 반영
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 저장된 로그인 정보를 확인하는 동안 표시
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#3D5AFE"
        />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 로그인하지 않은 사용자만 접근 */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* 로그인한 사용자만 접근 */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },
});