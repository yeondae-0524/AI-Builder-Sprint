import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { MissionProvider } from "../_mission-context";

const ACTIVE_COLOR = "#171719";
const INACTIVE_COLOR = "#A0A0A6";

export default function TabLayout() {
  return (
    <MissionProvider>
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarHideOnKeyboard: true,

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 1,
        },

        tabBarItemStyle: {
          borderRadius: 24,
        },

        tabBarStyle: {
          position: "absolute",

          left: 24,
          right: 24,
          bottom: 14,

          height: 62,
          paddingTop: 6,
          paddingBottom: 6,

          backgroundColor: "#FFFFFF",

          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "rgba(0, 0, 0, 0.04)",

          // 높이의 절반으로 설정하면 완전한 캡슐 모양
          borderRadius: 31,

          shadowColor: "#000000",
          shadowOffset: {
            width: 0,
            height: 3,
          },
          shadowOpacity: 0.1,
          shadowRadius: 10,

          elevation: 7,
        },
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: "캘린더",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="discover"
        options={{
          title: "발견",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "compass" : "compass-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="essay"
        options={{
          title: "에세이",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "book" : "book-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="my"
        options={{
          title: "MY",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
    </MissionProvider>
  );
}