import "expo-sqlite/localStorage/install";

import { Redirect } from "expo-router";

export default function AuthIndexScreen() {
  const hasAccount =
    localStorage.getItem("hasAccount") === "true";

  if (hasAccount) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(auth)/signup" />;
}