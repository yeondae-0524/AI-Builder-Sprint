import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

type AuthRoute =
  | "/(auth)/login"
  | "/(auth)/signup";

export default function AuthIndexScreen() {
  const [targetRoute, setTargetRoute] =
    useState<AuthRoute | null>(null);

  useEffect(() => {
    const hasAccount =
      typeof globalThis.localStorage !== "undefined" &&
      globalThis.localStorage.getItem("hasAccount") ===
        "true";

    setTargetRoute(
      hasAccount
        ? "/(auth)/login"
        : "/(auth)/signup",
    );
  }, []);

  if (!targetRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#3D5AFE"
        />
      </View>
    );
  }

  return <Redirect href={targetRoute} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },
});