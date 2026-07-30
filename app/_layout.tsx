import type { Session } from "@supabase/supabase-js";
import { Stack } from "expo-router";
import { createContext, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";
import { getMyProfile } from "../services/profile.service";

type PreferencesContextType = {
  recheckPreferences: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextType>({
  recheckPreferences: async () => {},
});

export function usePreferencesRecheck() {
  return useContext(PreferencesContext);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPreferences, setNeedsPreferences] = useState(false);

  const checkPreferences = async (currentSession: Session | null) => {
    console.log("③ checkPreferences 호출, session 있음:", !!currentSession);
    if (!currentSession) {
      setNeedsPreferences(false);
      return;
    }
    try {
      const profile = await getMyProfile();
      console.log("④ interests 값:", profile.interests);
      const needsIt = !profile.interests || profile.interests.length === 0;
      console.log("⑤ needsPreferences =", needsIt);
      setNeedsPreferences(needsIt);
    } catch (error) {
      console.log("❌ 프로필 조회 실패:", error);
      setNeedsPreferences(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { session: savedSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSession(savedSession);
      await checkPreferences(savedSession);

      if (isMounted) setIsLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      await checkPreferences(nextSession);

      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3D5AFE" />
      </View>
    );
  }

  return (
    <PreferencesContext.Provider
      value={{
        recheckPreferences: async () => {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          await checkPreferences(currentSession);
        },
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && needsPreferences}>
          <Stack.Screen name="preferences" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !needsPreferences}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </PreferencesContext.Provider>
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