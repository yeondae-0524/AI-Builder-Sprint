import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: {
          backgroundColor: "#F7F8FA",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          animation: "none",
        }}
      />

      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
    </Stack>
  );
}